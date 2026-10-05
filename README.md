Attendance Tracker
==================

A small progressive web app for taking attendance at a youth group meeting.
Tap a name and it is posted to a Google Form -- one tap, no confirm step. The
names sit in alphabetical order and stay there, so the tile under a thumb
never moves and someone marking a dozen people in a row is not fighting the
screen.

Live at <https://fidian.github.io/attendance-tracker/>.

It is built for two kinds of user at once. A parent installs it, keeps their
own child on the list, and marks one name a week. A leader or assistant uses
the same screen to mark several people in a row.

How it works
------------

* **A tap is the whole interaction.** The name lights up at once and stays lit
  until the entry lands, then fades back over about three quarters of a second.
  The fade is the confirmation, so nothing interrupts to say it worked.
  Tapping a name already in flight does nothing, and several names can be in
  flight at the same time.
* **The roster** holds up to 250 people in `localStorage`, always
  alphabetical, two columns on a phone and more on a tablet. Labels differing
  only by capitalization or extra spaces are the same person. Because nothing
  is ordered by recency there is nothing sensible to evict, so a full roster
  refuses a new row and says to remove one first rather than quietly dropping
  somebody.
* **The box above the list filters as you type**, which is how a roster of a
  hundred stays usable. It matches the start of any word in the label *or* in
  any field value, so a troop number finds everyone in that troop.
* **+ adds somebody by hand**, prompting for every question the form has and
  marking them straight away. It needs no sheet: a group that never imports
  anything works entirely this way.
* **The pencil turns on edit mode**, which puts a remove badge on each tile
  and stops taps from sending anything. Removing someone takes them off this
  device; it removes nothing already submitted.
* **There is no offline mode, on purpose.** An entry that cannot reach Google
  is not recorded anywhere, and a queue that silently holds entries is worse
  than a screen that says it cannot take them. When the browser reports no
  connection the names grey out and a banner says why; when a post fails
  anyway, that name says so and can be tapped again. Attendance is never
  written to the device, and a test asserts that. There is no service worker
  and nothing is cached: the app is installable from its web app manifest
  alone, and opening it with no connection simply does not load.

Making the Google Form
----------------------

The app posts to an ordinary Google Form, so the responses land in a
spreadsheet you already know how to read, and Google records the timestamp of
every entry for you.

1. At <https://forms.google.com> create a blank form and give it a name, such
   as *Attendance Form*.
2. Add a question for each thing you want recorded -- `First`, `Last`,
   `Troop`, whatever suits. **Every question has to be a Short answer.** The
   app cannot see a question's type or a dropdown's choices (see *Why short
   answers only* below), so it sends plain text to all of them and a dropdown
   would reject it.
3. Under **Responses**, link the form to a spreadsheet. Google adds a
   *Timestamp* column on its own, which is the attendance record; the app
   never sends a date.
4. Send the form once, or open it in a private window and submit a test entry,
   to confirm rows are arriving.

The app needs two things out of that form: which form it is, and what its
questions are. A **pre-filled link** carries both.

5. In the form editor, open the three-dot menu and choose **Get pre-filled
   link**. Now the trick: **type each question's own name into its box** --
   `First` into the first-name box, `Troop` into the troop box. Press **Get
   link**, then **Copy link**. It looks like this:

   ```
   https://docs.google.com/forms/d/e/1FAIpQL.../viewform?usp=pp_url&entry.111=First&entry.222=Last&entry.333=Troop
   ```

   The long string after `/d/e/` is the form; each `entry.N` is a question,
   and the value you typed is the name this app will use for it. Those values
   are never submitted -- they exist only to label the questions.

Anyone who can open the form can submit to it, which is what lets the app post
without a login. Keep the link among the leaders, and keep the spreadsheet
itself private.

### Why short answers only

Everything the app knows about the form comes out of that pre-filled address.
A question's *type*, and the choices in a dropdown, live only in the form
page's own markup, which Google serves without CORS headers -- a browser
cannot read it. The alternative is the Google Forms API, which is OAuth-only
and needs a verified app, which would mean a backend. So: short answers.

The roster sheet
----------------

Typing a hundred people in by hand is no fun, so the app can read them from a
second spreadsheet.

1. Make a sheet whose **first column is what the app shows** and whose other
   column headings **match your form's question names exactly** (case does not
   matter):

   | Displayed | First | Last | Troop |
   | --- | --- | --- | --- |
   | Claude (123) | Claude | Personname | 123 |
   | Claude (456) | Claude | Johnson | 456 |

   The first column never goes to the form. It exists so two people with the
   same name can be told apart on screen.
2. **File -> Share -> Publish to web**, pick that tab and
   *Comma-separated values (.csv)*, then publish and copy the address.
   Publishing is what adds the CORS headers that let a page with no backend
   read it; a sheet merely *shared by link* cannot be read and the app says
   so.
3. Paste it into **Roster sheet** on the settings screen and press **Import
   roster now**. Importing replaces the roster outright.

A published sheet is readable by anyone with its address, so put names in it
only if that is acceptable. Nothing forces you to use one: **+** on the main
screen adds people by hand, and a device that never imports anything works
fine.

Setting up a device
-------------------

The form settings are not in this repository, because the repository is
public. They live in `localStorage` on each device, and the app opens on the
settings screen until they are there. Reach it later with the wrench in the
corner.

**The first device.** Paste the whole pre-filled link into **Pre-filled Google
Form link**. The screen lists the questions it found so you can check them,
and the box then shows the form's id, which is the part that is stored. Add
the roster sheet if you have one, then press **Save**.

**Every device after that.** On the first device, open the settings and choose
*Share by QR code*. The code is this app's own address with the settings in
the fragment, so either of these works:

* point the other phone's ordinary camera at it and open the link -- the app
  loads already set up, and
* or use *Scan a QR code* in the app, which uses the camera directly.

The code carries the form, its questions and the roster sheet's address, so a
device set up this way pulls the roster down by itself the first time it
opens.

*Clear all info* forgets the settings and everyone on that device. Entries
already sent are untouched.

Upgrading
---------

Everything the app stores carries a schema version. When a release changes the
shape of any of it, the first load after that release clears the lot and the
device starts at the settings screen -- settings and roster are re-shared by
QR code in a few seconds, and an attendance record has never lived on a device
anyway.

To point the app at a different form, change the settings; nothing about the
form is compiled in.

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

Tests are plain Vitest under Node. The services are ordinary classes over
`localStorage` and `fetch`, and each screen's controller is kept apart from
the `component()` call that needs a real DOM, so the behavior behind the
screen is testable without a browser.

Layout
------

```
site/                index.html, the 404 redirect, the web app manifest,
                     icons, and the entry point
src/config.ts        the storage keys and schema version, the roster limit,
                     the share fragment name
src/services/        localStorage, the schema wipe, form settings, the roster,
                     CSV reading, posting, online state, QR drawing and
                     QR reading
src/app-root/        picks the screen
src/attendance-screen/
src/config-screen/
src/person-form/, src/qr-code/, src/qr-scanner/, src/install-pwa/
```

QR codes are drawn with `@tofandel/qrcode-svg`. Reading one uses the browser's
own `BarcodeDetector` where it exists; Safari has no such thing, so a
WebAssembly decoder is fetched the first time a scan starts there and never
lands in the main bundle.

Built with [Fudgel](https://fudgel.js.org/) and Vite.

Regenerating icons
------------------

`site/public/icon.svg` is the source. After changing it, run
`npm run generate-pwa-assets` and commit the PNGs it writes next to it.
