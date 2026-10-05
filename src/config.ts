/**
 * How many people the roster holds. A CSV import is truncated to this and
 * says so; adding by hand refuses past it, because with an alphabetical list
 * there is no recency to evict by.
 */
export const ROSTER_LIMIT = 250;

/**
 * Bumped whenever the shape of anything below changes. On start-up a stored
 * version that is not this one wipes every key in `STORAGE_KEYS`, so an app
 * that has been upgraded never reads a record written to an older shape.
 */
export const SCHEMA_VERSION = 2;

export const SCHEMA_VERSION_KEY = 'schemaVersion';

/**
 * Every key this app has ever written. Retired keys stay on the list so a
 * schema change clears them off devices that still carry them.
 */
export const STORAGE_KEYS = [
    'formConfig',
    'roster',
    // Retired.
    'recentNames',
    'pendingEntries',
];

/**
 * Where the form settings ride when they are shared. The app's own URL plus
 * this fragment is what the QR code encodes, so a plain phone camera can open
 * an already-configured app; the in-app scanner reads the same thing.
 */
export const CONFIG_HASH_KEY = 'config';

/** Where the instructions live, linked from the settings screen. */
export const PROJECT_URL = 'https://github.com/fidian/attendance-tracker';

/**
 * Sections of the README, linked from the setup screen so somebody holding a
 * phone can get to the long version of whatever step they are stuck on. The
 * fragments are GitHub's own heading anchors; renaming a heading in
 * `README.md` breaks one.
 */
export const DOCS = {
    form: `${PROJECT_URL}#making-the-google-form`,
    roster: `${PROJECT_URL}#the-roster-sheet`,
    setup: `${PROJECT_URL}#setting-up-a-device`,
    shortAnswers: `${PROJECT_URL}#why-short-answers-only`,
};
