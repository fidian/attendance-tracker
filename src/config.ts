/**
 * A sanity cap on how many people one event's roster holds. This used to be
 * a storage limit; with a database behind it, it only exists so a mistaken
 * import of a huge spreadsheet says so instead of filling the screen.
 */
export const ROSTER_LIMIT = 1000;

/**
 * Bumped whenever the shape of anything below changes. On start-up a stored
 * version that is not this one wipes every key in `STORAGE_KEYS`, so an app
 * that has been upgraded never reads a record written to an older shape.
 */
export const SCHEMA_VERSION = 3;

export const SCHEMA_VERSION_KEY = 'schemaVersion';

/**
 * Every key this app has ever written. Retired keys stay on the list so a
 * schema change clears them off devices that still carry them.
 */
export const STORAGE_KEYS = [
    'connection',
    // Retired.
    'formConfig',
    'roster',
    'recentNames',
    'pendingEntries',
];

/**
 * Where the connection settings ride when they are shared. The app's own URL
 * plus this fragment is what the QR code encodes, so a plain phone camera can
 * open an already-configured app; the in-app scanner reads the same thing.
 */
export const CONFIG_HASH_KEY = 'db';

/** Where the group id rides in that same fragment. */
export const GROUP_HASH_KEY = 'g';

/** Where the instructions live, linked from the setup screen. */
export const PROJECT_URL = 'https://github.com/fidian/attendance-tracker';

/**
 * Sections of the README, linked from the setup screen so somebody holding a
 * phone can get to the long version of whatever step they are stuck on. The
 * fragments are GitHub's own heading anchors; renaming a heading in
 * `README.md` breaks one, and `config.test.ts` fails when it does.
 */
export const DOCS = {
    firebase: `${PROJECT_URL}#setting-up-firebase`,
    roster: `${PROJECT_URL}#the-roster-file`,
    sharing: `${PROJECT_URL}#setting-up-another-phone`,
    security: `${PROJECT_URL}#who-can-see-your-data`,
};
