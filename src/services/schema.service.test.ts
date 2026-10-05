import { beforeEach, describe, expect, it } from 'vitest';
import {
    SCHEMA_VERSION,
    SCHEMA_VERSION_KEY,
    STORAGE_KEYS,
} from '../config';
import { clearEverything, ensureSchema } from './schema.service';
import { storage } from './local-storage.service';

describe('ensureSchema', () => {
    beforeEach(() => {
        storage.clear();
    });

    it('marks a fresh device and reports that it wrote', () => {
        expect(ensureSchema()).toBe(true);
        expect(storage.getItem(SCHEMA_VERSION_KEY)).toBe(
            String(SCHEMA_VERSION)
        );
    });

    it('does nothing on a device already at this version', () => {
        ensureSchema();
        storage.setItem('roster', 'keep me');

        expect(ensureSchema()).toBe(false);
        expect(storage.getItem('roster')).toBe('keep me');
    });

    it('wipes every known key when the stored version is older', () => {
        storage.setItem(SCHEMA_VERSION_KEY, '1');

        for (const key of STORAGE_KEYS) {
            storage.setItem(key, 'stale');
        }

        expect(ensureSchema()).toBe(true);

        for (const key of STORAGE_KEYS) {
            expect(storage.getItem(key)).toBeNull();
        }
    });

    it('wipes retired keys an older build left behind', () => {
        storage.setItem('recentNames', 'old');
        storage.setItem('pendingEntries', 'older');
        ensureSchema();

        expect(storage.getItem('recentNames')).toBeNull();
        expect(storage.getItem('pendingEntries')).toBeNull();
    });

    it('wipes an unversioned device, which is any build before this one', () => {
        storage.setItem('formConfig', 'from v1');

        expect(ensureSchema()).toBe(true);
        expect(storage.getItem('formConfig')).toBeNull();
    });
});

describe('clearEverything', () => {
    beforeEach(() => {
        storage.clear();
    });

    it('removes the data', () => {
        ensureSchema();
        storage.setItem('roster', 'x');
        clearEverything();

        expect(storage.getItem('roster')).toBeNull();
    });

    /**
     * Clearing and then setting the device up again from a scanned code must
     * survive the next load. If the marker went away, that load would take
     * the device for an older build and wipe the new settings.
     */
    it('leaves the device marked as current', () => {
        ensureSchema();
        clearEverything();

        expect(storage.getItem(SCHEMA_VERSION_KEY)).toBe(
            String(SCHEMA_VERSION)
        );

        storage.setItem('formConfig', 'set up again after clearing');
        expect(ensureSchema()).toBe(false);
        expect(storage.getItem('formConfig')).toBe(
            'set up again after clearing'
        );
    });
});
