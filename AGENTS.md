# AGENTS.md

An attendance app. You pick an event, tap somebody, and they are marked
present on every phone looking at that event. This file is for anyone
changing it. `README.md` is for anyone *using* it and explains the Firebase
setup, which is worth reading first.

## Layout

- `site/` - `index.html` (the whole stylesheet: CSS custom properties, light
  and dark), `main.ts`, `404.html`, and `public/` with the icons and the web
  app manifest.
- `firebase/database.rules.json` - the security rules, pasted into the console
  by hand. Not deployed by anything.
- `src/services/` - plain classes, most of them with no DOM and no Fudgel.
  `firebase.service.ts` is the only file that imports the SDK;
  `config.service.ts` holds the connection, `event.service.ts` and
  `roster.service.ts` the data, `sheet.service.ts` import and export,
  `backup.service.ts` the whole-group file, `navigation.service.ts` the query
  string, plus `local-storage`, `online`, `schema`, `qr`, `scanner`, `csv`,
  `text` and the embedded `seed`.
- `src/<screen>/` - one folder per component: `*.component.ts` calls
  `component()`, `*.module.ts` re-exports it, and screens with logic keep that
  logic in `*.controller.ts` (see Rules). Four screens: `setup-screen`,
  `event-list-screen`, `event-screen`, `people-screen`, plus the shared
  `app-menu` and `app-root`.
- `src/config.ts` - the roster limit, the `localStorage` keys, the schema
  version, the share fragment names. No database details: those are per
  device, and nothing about any database is built into the app.
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

## Rules

- **Nothing about any database is compiled in.** The app ships with no
  address. It is typed in once or arrives by QR, and lives on the device.
  Never commit a real database address, group id or project name, including
  in a test fixture that looks real.
- **The rules in `firebase/database.rules.json` are load-bearing, and three
  parts of them are not obvious.** `groups` has no `.read`, so the ids cannot
  be listed and the address alone finds nothing. A write may not leave a group
  empty, which is why every group carries a `meta` record -- without it,
  deleting your last event would empty the group and be refused. And only the
  shapes this app writes are accepted, which keeps the database from being
  used as a stranger's file store. Changing any of these means re-checking the
  others; the README documents what each one buys.
- **Attendance is never kept on the device.** There is no offline mode and no
  queue: a tap that cannot reach the database is not recorded and the screen
  says so. With shared data this matters more than it did, because a queued
  tap replayed later would overwrite somebody else's work.
- **Events and rosters are siblings, not nested.** Realtime Database reads
  whole subtrees, so nesting would make listing events drag every person of
  every event down the wire. They still delete together, in one all-or-nothing
  multi-path write.
- **Roster listeners are per child, never `onValue`.** Watching the subtree
  re-sends all 250 people on every tap, to every device watching.
- **Each event stores its own `columns`.** Object key order is not preserved
  on read -- the sample roster's `{First, Last, Dept}` comes back
  `{Dept, First, Last}` -- so an export built from the stored values alone
  would silently shuffle its columns.
- **Changing a stored shape means bumping `SCHEMA_VERSION`.** The next load
  then wipes every key in `STORAGE_KEYS` rather than reading a record written
  to the old shape. A key that stops being used stays on that list so the wipe
  reaches devices still carrying it.
- **A screen is reused when only its parameter changes.** Going from one event
  straight to another keeps the same element alive, so `onInit` does not run
  again. Opening an event lives in `_open(eventId)`, called from `onInit` and
  from a navigation subscription. This was a real bug: the header kept the old
  event's name and the roster listener stayed on the old event.
- **Where you are lives in the query string, not the fragment.** The fragment
  belongs to the connection a shared QR code carries, and GitHub Pages serves
  `?event=x` from the app while a path segment would hit the 404 page.
- **Spreadsheet cells are written as text.** Left to guess, a spreadsheet
  turns `007` into `7` and `3-4` into a date. A name beginning `=`, `+`, `-`
  or `@` is escaped, because these files are made to be opened in Excel --
  and so are the **column headings**, which come from whatever file was
  imported and are just as attacker-supplied as a name.
- **Adopting a connection from the fragment asks first when it would replace
  a different one.** A link sent to somebody already set up would otherwise
  repoint their phone at the sender's database without a word, and the
  evening's attendance would be taken into it. A device with nothing yet, or
  one handed the connection it already has, still adopts silently -- that is
  the sharing feature and it stays one scan.
- **`write-excel-file` and `read-excel-file` are dynamically imported**, like
  the barcode decoder, so they stay out of the bundle somebody downloads just
  to tap a name. They have no root export: use the `/browser` subpath in the
  app and `/node` in tests.
- **A controller that holds logic lives in its own file**, apart from the
  `component()` call. `component()` scopes styles against a real `document`,
  so a module that calls it cannot be imported under Node, and the tests run
  under Node with no DOM shim.
- **Services take no constructor arguments and are reached through
  `src/di.ts`**, which re-exports `di` from the `fudgel` bundle and never from
  `fudgel/dist/di`; two copies of the injector would silently stop sharing
  instances. Tests use `diOverride`.
- **Fudgel's rules are in `~/repo/fudgel/docs/llms.txt`**; the ones that bite
  here are that names are camelCase in JavaScript and dash-case in HTML, that
  a binding re-runs only when a top-level identifier in it is assigned (so
  `isPending(id, pending)` takes state as arguments rather than reading
  `this`), and that form controls bind by property, not attribute.
- **The base path is one constant.** `BASE` in `vite.config.ts` is
  `/attendance-tracker/` because the site is a project page. The manifest uses
  relative paths and does not repeat it.
- Formatting: 4-space indent, single quotes, `arrowParens: avoid`. Match the
  file you are in.

## Testing, and what is deliberately not tested

Vitest runs `environment: 'node'` with no DOM shim.

**Do not mock a service that is entirely internal.** Build the real thing over
the real `localStorage` shim: a test that stands in for `ConfigService` or
`RosterService` proves only that the stand-in behaves as written, and the
decisions worth checking live in those services.

**A service that reaches out may be mocked**, and `firebase.service.ts` is the
one that does. The SDK talks over a WebSocket, which cannot be stubbed the way
`fetch` can, and faking one faithfully costs more than it proves -- so that
file is the whole of the untestable surface, by design: it is the only file
importing the SDK and it holds no decisions, which makes it checkable by
reading. Standing a recorder in for it is how the wiring *around* it gets
tested, and that wiring has had real bugs: see `roster.watch.test.ts`, where
an event with nobody on it fired no child events and the screen said
"Loading..." forever.

Everything else is pure and tested directly: the stored-record readers
(`toEvent`, `toPerson`), `RosterTable` which is where live updates land,
route parsing, connection parsing and the share round trip, import and export
including column order and formula escaping, and a real `.xlsx` written and
read back through the libraries' Node entry points.

What that leaves for a person: realtime between two windows, the download
itself, and the camera scanner. Those are checked by hand against a live
database before a release.

## Where things are decided

- What a tap does: `event-screen.controller.ts` (`toggle`). There is no
  optimistic bookkeeping -- the write goes out and the listener is the only
  thing that sets `present`, so an echo cannot fight a tap.
- What counts as the same person, and the sort: `roster.service.ts`
  (`normalizeName`, `byDisplay`, which falls back to the id so two people
  called Sam never flicker).
- Which questions a person can be given answers to: `roster.service.ts`
  (`extraFields`). The event's `columns` lead because they are the only
  record of the import's order; the roster is then scanned so an event whose
  columns were never written still offers its fields, and what the scan finds
  is sorted, since read order means nothing. `people-screen.controller.ts`
  writes the result back to the event the first time somebody adds or edits,
  because an answer to a question the event does not list is never exported.
- What an edit may change: `roster.service.ts` (`update`), which writes
  `display` and `extra` and deliberately leaves `present` out. Presence
  belongs to the tap, and a form opened a minute ago must not undo somebody
  else's mark.
- What a pasted address or scanned code may mean: `config.service.ts`
  (`normalizeDatabaseUrl`, `deserializeConnection`, `newGroupId`).
- How a sheet becomes people and back: `sheet.service.ts` (`rowsToPeople`,
  `rosterToRows`, `reportToRows`, `escapeCell`).
- Which screen opens: `app-root.component.ts` and `navigation.service.ts`.
