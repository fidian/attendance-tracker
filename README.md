Attendance Tracker
==================

A small progressive web app for taking attendance at a youth group meeting.
Tap a name and it is posted to a Google Form -- one tap, no confirm step. The
names sit in alphabetical order and stay there, so the row under a thumb never
moves and someone marking a dozen people in a row is not fighting the screen.

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
* **The list** holds up to 25 names in `localStorage`, always alphabetical.
  Names differing only by capitalization or extra spaces are the same person.
  Because nothing is ordered by recency there is nothing sensible to evict, so
  a full list refuses a new name and says to remove one first rather than
  quietly dropping somebody.
* **A new name** goes in the field above the list. The green checkmark adds it
  and marks that person in the same press. The red trash can beside a name
  drops it from the list; it removes nothing already submitted.
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
2. Add **one** question. Make it **Short answer**, title it `Name`, and turn
   **Required** on. Do not add any other required questions -- the app sends
   the name and nothing else, so a second required question makes Google
   reject every entry.
3. Under **Responses**, link the form to a spreadsheet. Google adds a
   *Timestamp* column on its own, which is the attendance record; the app
   never sends a date.
4. Send the form once, or open it in a private window and submit a test entry,
   to confirm rows are arriving.

The app needs two things out of that form: which form it is, and which
question holds the name. A **pre-filled link** carries both, which is why the
setup screen asks for one.

5. In the form editor, open the three-dot menu and choose **Get pre-filled
   link**. Type anything into the name box -- it is never submitted -- and
   press **Get link**, then **Copy link**. It looks like this:

   ```
   https://docs.google.com/forms/d/e/1FAIpQL.../viewform?usp=pp_url&entry.1591734977=Sample
   ```

   The long string after `/d/e/` is the form, and `entry.1591734977` is the
   name question.

Anyone who can open the form can submit to it, which is what lets the app post
without a login. Keep the link among the leaders, and keep the spreadsheet
itself private.

Setting up a device
-------------------

The form settings are not in this repository, because the repository is
public. They live in `localStorage` on each device, and the app opens on the
settings screen until they are there. Reach it later with the wrench in the
corner.

**The first device.** Paste the whole pre-filled link into **Google Form link
or ID** and press **Save**. The link carries the name field's id too, so the
second box fills itself in; the first box then shows the form's id, which is
the part that actually gets stored. If you only have a plain form address,
paste it and type the name field in by hand as `entry.1591734977`.

**Every device after that.** On the first device, open the settings and choose
*Share by QR code*. The code is this app's own address with the settings in
the fragment, so either of these works:

* point the other phone's ordinary camera at it and open the link -- the app
  loads already set up, and
* or use *Scan a QR code* in the app, which uses the camera directly.

*Clear all info* forgets the settings and every name on that device. Entries
already sent are untouched.

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
src/config.ts        the storage keys, the list limit, the share fragment name
src/services/        localStorage, form settings, the name list, posting,
                     online state, QR drawing and QR reading
src/app-root/        picks the screen
src/attendance-screen/
src/config-screen/
src/new-name-form/, src/qr-code/, src/qr-scanner/, src/install-pwa/
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
