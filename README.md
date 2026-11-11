Attendance Tracker
==================

A small progressive web app for taking attendance at a meeting. Pick an
event, tap a name, and that person is marked present — on every phone looking
at the same event, straight away. Tap again to unmark.

Live at <https://fidian.github.io/attendance-tracker/>.

It is built for a registration desk. Two leaders stand at the door with their
own phones, both marking people off the same list, and neither has to ask the
other who has already been seen. Setting the second phone up is one scan of a
QR code.

How it works
------------

* **Events.** An event is a meeting — "2026-11-08 Troop Meeting". It owns its
  own roster, so last week's event still shows who was there. A new event can
  start empty or as a copy of an existing one, and copying brings the people
  across without their attendance.
* **A tap is the whole interaction.** Tapping someone marks them present and
  writes it immediately. Present people stay highlighted. There is no save
  button and no confirm step.
* **Everyone sees the same thing.** The roster is held in a Firebase Realtime
  Database rather than on any one phone, so a tap on one device appears on the
  others without a reload.
* **Rosters move in and out** as CSV or XLSX, and the attendance record comes
  out as a report.
* **Everything can be backed up** to a single file from the event list, and
  restored from it. Worth doing occasionally: Google eventually reclaims a
  project nobody touches, and a group cannot be deleted from inside the app,
  so a file you hold is the way out of both.
* **There is no offline mode, on purpose.** A tap that cannot reach the
  database is not recorded, and the screen says so. Holding taps on a device
  and replaying them later would let a stale phone quietly overwrite somebody
  else's work.

Setting up Firebase
-------------------

You need a Firebase project with a **Realtime Database**. It is free, needs no
payment method, and — unlike several alternatives — is not paused when it goes
unused for a while, which matters for a group that meets weekly.

### 1. Create the project

1. Go to <https://console.firebase.google.com> and sign in.
2. **Create a project**. Name it anything, such as `attendance`.
3. Google Analytics is offered. This app does not use it; turning it off is
   one less thing to configure.

The project lands on the free **Spark** plan, which asks for no card.

### 2. Create the database

1. In the left sidebar open **Databases & Storage → Realtime Database**, then
   **Create Database**.

   Be careful here: Firebase offers **Firestore Database** as well, and the
   two are different products. This app uses **Realtime Database**. If you
   end up on a screen talking about collections and documents, you have the
   wrong one.

2. A two-step dialog opens. The first step is **Database options** — pick a
   location near you and press **Next**. The default, United States
   (us-central1), is fine.
3. The second step is **Security rules**. **Start in locked mode** is already
   selected; leave it. Locked mode denies everything, which is correct — the
   next step replaces the rules with ones that actually fit.

   Do not switch to test mode. Its open rules let anybody read and write your
   data, and the dialog itself warns that you must replace them within **30
   days**, after which the database starts denying every request with no
   obvious explanation.

4. Press **Enable**.

### 3. Publish the rules

Open the **Rules** tab of the database, replace everything there with the
contents of [`firebase/database.rules.json`](firebase/database.rules.json)
from this repository, and press **Publish**.

They are longer than you might expect, and each part is doing a job:

* **Reads and writes need a group id** of 22 to 64 characters from a
  restricted alphabet. Nothing may list the groups, so the database address on
  its own finds nothing.
* **A write may not empty a group.** Without this, one stray request could
  erase everything you have. It is also why each group keeps a small `meta`
  record: deleting your last event empties `events` and `roster`, and `meta`
  is what keeps the group itself alive.
* **Only the shapes this app writes are accepted** — events, rosters and that
  marker, with names and values capped in length. Anything else is refused,
  which stops the database being used as somebody's free file store.

What all this protects, and what it does not, is under
[Who can see your data](#who-can-see-your-data).

### 4. Copy the database address

1. Still in **Realtime Database**, open the **Data** tab. The address is
   printed in a bar above the data, and looks like one of these:

   ```
   https://attendance-12345-default-rtdb.firebaseio.com
   https://attendance-12345-default-rtdb.europe-west1.firebasedatabase.app
   ```

   The first form is for databases in `us-central1`; everywhere else gets the
   second. Either is fine — copy whichever yours shows.

2. Open the app, and paste it into **Database address** on the setup screen.

That is all the app needs. There is no schema to create and nothing to
migrate: the first time the app finds the database empty it offers to fill it
with a sample roster and a sample event so there is something to look at.

The roster file
---------------

A roster is a spreadsheet — CSV or XLSX — whose **first column is the name the
app shows**. Every other column is remembered and comes back on export, but is
never displayed:

| Display | First | Last | Dept |
| --- | --- | --- | --- |
| Harry P. (Auror) | Harry | Potter | Auror |
| Hermione G. (Law) | Hermione | Granger | Law |
| Ron W. (Auror) | Ron | Weasley | Auror |

The first column exists so two people with the same name can be told apart on
screen. Keep it short: a tile is half a phone screen wide — 169 pixels at 375 —
and measured against this roster, names up to 19 characters fit while
21 is cut off with an ellipsis. Twenty is about the limit, and it is a
width rather than a count, so wide letters run out sooner.

Exporting the roster gives that sheet back, columns in the same order.
Exporting the **attendance report** gives the same sheet with one extra
column at the front saying `Yes` or `No` for each person.

Both are offered as CSV. Import accepts CSV or XLSX. Every cell is written as
text, so `007` stays `007` and a name like `3-4` is not turned into a date,
and a name beginning `=`, `+`, `-` or `@` is escaped so a spreadsheet shows it
rather than running it.

Nothing forces you to use a file at all — people can be added by hand on the
manage-people screen, and a group that never imports anything works fine.

Setting up another phone
------------------------

On a phone that is already working, open the menu, choose **Settings**, then
**Share with another phone**. It shows a QR code, and below it the same thing
written out as a link.

On the new phone, either point its ordinary camera at the code and open the
link, or use **Scan** in the app. Either way it arrives already set up: the
code carries both the database address and the group id, which is everything
needed and the only place either of them is written down.

When the other phone is not in the room, **Copy** puts that link on the
clipboard to send. It is the same link the code encodes, so opening it does
the same job — which also means sending it is sending the key, and anyone who
reads the message on the way is set up too. A code held up between two people
is seen by the two of them; a link lives in whatever carried it. Prefer the
code when both phones are present.

Who can see your data
---------------------

**Anyone who gets that QR code can read, change and delete everything in your
group.** That is the point of it: handing a second leader a working phone has
to take seconds, not minutes. Treat the code like a door key, and do not put
it on a slide or a noticeboard.

What the code is *not* is a thing anyone can find by looking at the app.
**Nothing in the published app points at any database.** It is built with no
address in it at all; the address is typed in once, or arrives by QR, and is
kept on the device. Two separate things have to be known before a request can
reach your data, and both of them only ever travel in that code:

* **The database address**, which belongs to your Firebase project. Not
  published anywhere, though it is not a strong secret either — it is derived
  from the project name plus a short suffix Firebase picks, so treat it as
  hard to guess rather than impossible.
* **The group id**, which is 128 random bits generated on the device. This is
  the part that actually protects you. The rules deny listing, so nothing can
  ask the database what groups exist; reads and writes are only allowed
  underneath an id already known.

That is not a theory. Against a database with these rules published, asking
for the list of groups and asking for a short guessed id both come back
`401 Permission denied`, while reading and writing under a known 22-character
id both succeed:

```
GET    /groups.json                        -> 401 Permission denied
GET    /groups/short.json                  -> 401 Permission denied
PUT    /groups/<id>/events/e1.json         -> 200
PUT    /groups/<id>/roster/e1/p1.json      -> 200
DELETE /groups/<id>/events/e1.json         -> 200   (your last event is fine)
DELETE /groups/<id>.json                   -> 401   (one call cannot wipe it)
PUT    /groups/<id>/junk.json              -> 401   (shape is enforced)
```

Two limits worth knowing:

* **The rules cannot tell your group id from any other well-formed one.**
  Somebody who learned your database address could not find your data, but
  they could write their own under an id they invent, against your free
  quota. Since the address is not published, this needs them to go looking
  first. The rules cap the shapes and sizes they could store, which makes it
  a poor place to dump files; if the address ever does get attention,
  [App Check](https://firebase.google.com/docs/app-check) proves a request
  came from your app and shuts the door entirely.
* **A group cannot be deleted from inside the app**, because that is the same
  rule that stops one request erasing everything. Abandoning a group means
  forgetting it; genuinely removing the data means deleting the node in the
  Firebase console.

Two consequences:

* **A link that would move a phone to a *different* database asks first**,
  naming the host, so a link from somebody else cannot quietly redirect an
  evening's attendance. Setting up a new phone is unaffected.
* **There is no way to revoke one phone.** If a code gets out, the fix is to
  make a new group and re-share it. That is one of the reasons the app can
  back its data up and restore it.
* **Never put a Firebase service-account or admin key in this app**, or in a
  QR code. The database address is the only credential that belongs here.

Deploying
---------

`.github/workflows/deploy.yml` type checks, tests, and builds on every push
and pull request, and publishes to GitHub Pages from `master`. It needs Pages
set to **GitHub Actions** as its source, under Settings -> Pages.

The site lives in a subfolder, so `base` in `vite.config.ts` is
`/attendance-tracker/`. A fork under a different repository name changes that
one line; `site/public/manifest.webmanifest` uses relative paths and needs no
edit.

Developing
----------

`AGENTS.md` describes the conventions for working on this app.

```bash
npm install
npm start        # dev server on http://localhost:1976/attendance-tracker/
npm test         # Vitest, once
npm run test:watch
npm run typecheck
npm run build    # type check, then build to dist/
npm run preview  # serve the build
```

Tests are plain Vitest under Node. Each screen's controller is kept apart from
the `component()` call that needs a real DOM, so the behavior behind the
screen is testable without a browser. The one file that talks to Firebase is
deliberately thin, because a WebSocket cannot be faked the way a `fetch` can;
everything worth asserting lives in pure code beside it.

Regenerating icons
------------------

`site/public/icon.svg` is the source. After changing it, run
`npm run generate-pwa-assets` and commit the PNGs it writes next to it.
