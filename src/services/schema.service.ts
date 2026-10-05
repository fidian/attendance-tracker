import {
    SCHEMA_VERSION,
    SCHEMA_VERSION_KEY,
    STORAGE_KEYS,
} from '../config';
import { storage } from './local-storage.service';

/**
 * Clears everything this app has stored when the shape it was written in is
 * not the shape this build reads. Must run before any service touches
 * storage, which is why `bootstrap` calls it first.
 */
export const ensureSchema = () => {
    const found = storage.getItem(SCHEMA_VERSION_KEY);

    if (found === String(SCHEMA_VERSION)) {
        return false;
    }

    for (const key of STORAGE_KEYS) {
        storage.removeItem(key);
    }

    storage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));

    return true;
};

/**
 * Forgets the form settings and the roster, but leaves the version marker in
 * place. The marker is not user data: dropping it would make the next load
 * think the device predates this build and wipe it again, which would throw
 * away settings scanned in between.
 */
export const clearEverything = () => {
    for (const key of STORAGE_KEYS) {
        storage.removeItem(key);
    }

    storage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
};
