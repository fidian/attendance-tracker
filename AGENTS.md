# AGENTS.md

A one-screen attendance app: tap a name, it posts to a Google Form. This file
is for anyone changing it. `README.md` is for anyone *using* it and explains
the Google Form setup, which is worth reading first.

## Layout

- `site/` - `index.html` (the whole stylesheet: CSS custom properties, light
  and dark), `main.ts`, `404.html`, and `public/` with the icons and the web
  app manifest.
- `src/services/` - plain classes over `localStorage` and `fetch`, with no DOM
  and no Fudgel. `schema.service.ts` wipes storage when its shape changes,
  `config.service.ts` holds the form settings and the parsing and sharing of
  them, `roster.service.ts` the people, `csv.service.ts` reads a published
  sheet, `attendance.service.ts` makes the single post, `online.service.ts`
  tracks the connection, `qr.service.ts` draws a code and
  `scanner.service.ts` reads one.
- `src/<screen>/` - one folder per component: `*.component.ts` calls
  `component()`, `*.module.ts` re-exports it, and screens with logic keep that
  logic in `*.controller.ts` (see Rules).
- `src/config.ts` - the roster limit, the `localStorage` keys, the schema
  version, the share fragment name. No form details: those are per device.
- `.github/workflows/deploy.yml` - checks on every push and pull request,
  deploys to GitHub Pages from `master`.

## Commands

```bash
npm start        # dev server on http://localhost:1976/attendance-tracker/
npm test         # Vitest under Node, once
npm run test:watch
npm run typecheck
npm run build    # type check, then build to dist/
npm run preview  # serve the build
```

`npm test` takes about a second. There is no browser test runner; see Rules.

## Rules

- **Attendance is never stored.** There is no offline mode and no queue: an
  entry that cannot reach Google is not recorded, and the screen says so. Do
  not add a retry queue, a service worker, a precache, or anything that
  implies an entry is safe when it is not. A test in
  `attendance-screen.controller.test.ts` fails if any key outside
  `STORAGE_KEYS` is written, and it is there to be tripped.
- **Nothing about the form is compiled in.** The repository is public. Form
  ids and field ids live in `localStorage` per device, arriving from a
  pre-filled link or a shared QR code. Never commit one, including in a test
  fixture that looks like a real form.
- **The list never reorders itself.** Alphabetical, always. An order that
  moved with use shuffles tiles between taps, and someone marking a dozen
  people in a row mis-taps. That also means there is no recency to evict by,
  so a full roster refuses a new row rather than guessing which to drop.
- **Changing a stored shape means bumping `SCHEMA_VERSION`.** The next load
  then wipes every key in `STORAGE_KEYS` rather than reading a record written
  to the old shape. A key that stops being used stays on that list so the
  wipe reaches devices still carrying it. `clearEverything` deliberately
  leaves the version marker behind: dropping it would make the following load
  wipe settings scanned in between.
- **What the app knows about the form comes only from a pre-filled link.**
  Google puts every filled box into the address as `entry.<id>=<value>`, so
  asking the leader to type each question's *name* into its own box hands over
  the ids and the wording at once, with no authentication. A question's type
  and a dropdown's choices are not in there -- they live in the form page,
  which Google serves without CORS headers -- so the form has to be short
  answers only, and the README says so.
- **A roster sheet has to be published to the web, not merely shared.**
  Publishing is what makes Google send CORS headers; shared-by-link does not,
  and a browser cannot read it. `CsvService` takes the field labels as an
  argument rather than reading the saved settings, because the setup screen
  imports before Save has been pressed.
- **The app has to work with no sheet at all.** `+` prompts for every
  question, so a group that never publishes anything can still use it.
- **A controller that holds logic lives in its own file**, apart from the
  `component()` call. `component()` scopes styles against a real `document`,
  so a module that calls it cannot be imported under Node, and the tests run
  under Node with no DOM shim. A component with no logic worth testing
  (`qr-code`, `new-name-form`) stays in one file.
- **Services take no constructor arguments and are reached through
  `src/di.ts`**, which re-exports `di` from the `fudgel` bundle and never from
  `fudgel/dist/di`; two copies of the injector would silently stop sharing
  instances. Tests use `diOverride`.
- **Fake only the network.** The tests build the real services over the real
  `localStorage` shim and stub `fetch`, so a test covers the path from a tap
  to a form post. A test that mocks a service is usually hiding the thing
  worth checking.
- **Fudgel's rules are in `~/repo/fudgel/docs/llms.txt`**; the ones that bite
  here are that names are camelCase in JavaScript and dash-case in HTML, that
  a binding re-runs only when a top-level identifier in it is assigned (so
  `isMarking(name, marking)` takes `marking` as an argument rather than
  reading it), and that form controls bind by property, not attribute.
- **The base path is one constant.** `BASE` in `vite.config.ts` is
  `/attendance-tracker/` because the site is a project page. The manifest uses
  relative paths and does not repeat it.
- Formatting: 4-space indent, single quotes, `arrowParens: avoid`. Match the
  file you are in.

## Where things are decided

- What a tap does, and the highlight that fades when the post lands:
  `attendance-screen.controller.ts` (`mark`, and `MIN_HIGHLIGHT_MS`, which
  exists so a fast connection still looks like something happened).
- What the filter matches: `attendance-screen.controller.ts` (`_matches`,
  which searches the label and every field value).
- What counts as the same person, and the sort:
  `roster.service.ts` (`normalizeName`, `compareKey`, `byLabel`).
- What a pasted link or scanned code is allowed to mean:
  `config.service.ts` (`parseFormUrl`, `deserializeConfig`).
- How a sheet becomes people: `csv.service.ts` (`parseCsv` for the file
  format, `toPeople` for the first-column-is-the-label rule).
- Which screen opens: `app-root.component.ts`. There is no router; the config
  fragment a shared QR code carries would collide with one.
