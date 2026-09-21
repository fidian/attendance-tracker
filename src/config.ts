/**
 * How many names the list holds. With no recency to evict by, a full list
 * refuses new names and points at the trash can instead of guessing.
 */
export const RECENT_NAME_LIMIT = 25;

/** localStorage keys, in one place so "clear all info" can be exhaustive. */
export const STORAGE_KEYS = ['formConfig', 'recentNames'];

/**
 * Where the form settings ride when they are shared. The app's own URL plus
 * this fragment is what the QR code encodes, so a plain phone camera can open
 * an already-configured app; the in-app scanner reads the same thing.
 */
export const CONFIG_HASH_KEY = 'config';
