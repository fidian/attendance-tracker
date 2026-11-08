import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ConfigService,
    deserializeConnection,
    GROUP_ID_PATTERN,
    isConnection,
    newGroupId,
    normalizeDatabaseUrl,
    serializeConnection,
} from './config.service';
import { storage } from './local-storage.service';

const URL_US = 'https://attendance-sample-default-rtdb.firebaseio.com';
const URL_EU =
    'https://attendance-sample-default-rtdb.europe-west1.firebasedatabase.app';
const GROUP = 'M5wzfssFBd3AYKAEVCdqiX';
const CONNECTION = { databaseUrl: URL_US, groupId: GROUP };

describe('newGroupId', () => {
    it('makes an id the database rules will accept', () => {
        for (let i = 0; i < 50; i++) {
            expect(newGroupId()).toMatch(GROUP_ID_PATTERN);
        }
    });

    it('is 22 characters, which is 128 bits', () => {
        expect(newGroupId()).toHaveLength(22);
    });

    it('does not repeat', () => {
        const seen = new Set(Array.from({ length: 200 }, () => newGroupId()));

        expect(seen.size).toBe(200);
    });
});

describe('normalizeDatabaseUrl', () => {
    it('accepts a us-central1 address', () => {
        expect(normalizeDatabaseUrl(URL_US)).toBe(URL_US);
    });

    it('accepts an address in another region', () => {
        expect(normalizeDatabaseUrl(URL_EU)).toBe(URL_EU);
    });

    it('strips a trailing slash, a path and a query', () => {
        expect(normalizeDatabaseUrl(`${URL_US}/`)).toBe(URL_US);
        expect(normalizeDatabaseUrl(`${URL_US}/data?x=1`)).toBe(URL_US);
    });

    it('trims and adds the scheme when it was left off', () => {
        expect(
            normalizeDatabaseUrl('  attendance-sample-default-rtdb.firebaseio.com ')
        ).toBe(URL_US);
    });

    it('lowercases the host', () => {
        expect(
            normalizeDatabaseUrl('https://Attendance-Sample-Default-RTDB.firebaseio.com')
        ).toBe(URL_US);
    });

    /** A Firestore address is the mistake the setup screen most expects. */
    it('refuses anything that is not a Realtime Database address', () => {
        for (const bad of [
            '',
            '   ',
            'not a url',
            'https://console.firebase.google.com/project/x',
            'https://firestore.googleapis.com/v1/projects/x',
            'https://example.com',
            'http://attendance-sample-default-rtdb.firebaseio.com',
        ]) {
            expect(normalizeDatabaseUrl(bad), bad).toBeNull();
        }
    });
});

describe('isConnection', () => {
    it('accepts a well-formed pair', () => {
        expect(isConnection(CONNECTION)).toBe(true);
    });

    it('refuses a group id the database rules would reject', () => {
        for (const groupId of ['', 'short', 'has.dots.in.it.xxxxxxx', 'a'.repeat(65)]) {
            expect(
                isConnection({ databaseUrl: URL_US, groupId }),
                groupId
            ).toBe(false);
        }
    });

    it('refuses an address that is not normalized', () => {
        expect(
            isConnection({ databaseUrl: `${URL_US}/`, groupId: GROUP })
        ).toBe(false);
    });
});

describe('serializeConnection / deserializeConnection', () => {
    it('round trips', () => {
        expect(
            deserializeConnection(`#${serializeConnection(CONNECTION)}`)
        ).toEqual(CONNECTION);
    });

    it('round trips a regional address', () => {
        const connection = { databaseUrl: URL_EU, groupId: GROUP };

        expect(
            deserializeConnection(`#${serializeConnection(connection)}`)
        ).toEqual(connection);
    });

    it('reads it out of a whole shared URL', () => {
        expect(
            deserializeConnection(
                `https://fidian.github.io/attendance-tracker/#${serializeConnection(CONNECTION)}`
            )
        ).toEqual(CONNECTION);
    });

    it('refuses a fragment that carries no connection', () => {
        expect(deserializeConnection('')).toBeNull();
        expect(deserializeConnection('#something-else')).toBeNull();
    });

    it('refuses a fragment missing either half', () => {
        expect(deserializeConnection(`#db=${encodeURIComponent(URL_US)}`)).toBeNull();
        expect(deserializeConnection(`#g=${GROUP}`)).toBeNull();
    });

    it('refuses a fragment whose group id would fail the rules', () => {
        expect(
            deserializeConnection(`#db=${encodeURIComponent(URL_US)}&g=short`)
        ).toBeNull();
    });
});

describe('ConfigService', () => {
    beforeEach(() => {
        storage.clear();
    });

    it('starts unconfigured', () => {
        const config = new ConfigService();

        expect(config.isConfigured()).toBe(false);
        expect(config.get()).toBeNull();
        expect(config.groupPath()).toBe('');
        expect(config.shareUrl('https://example.com/')).toBeNull();
    });

    it('keeps a connection and builds the group path', () => {
        const config = new ConfigService();

        expect(config.set(CONNECTION)).toBe(true);
        expect(config.databaseUrl()).toBe(URL_US);
        expect(config.groupPath()).toBe(`groups/${GROUP}`);
    });

    it('refuses a malformed connection', () => {
        const config = new ConfigService();

        expect(config.set({ databaseUrl: 'nope', groupId: GROUP })).toBe(false);
        expect(config.isConfigured()).toBe(false);
    });

    it('persists across instances', () => {
        new ConfigService().set(CONNECTION);

        expect(new ConfigService().get()).toEqual(CONNECTION);
    });

    it('ignores a value stored in the old Google Forms shape', () => {
        storage.setItem(
            'connection',
            JSON.stringify([1, { formId: 'x', fields: [] }])
        );

        expect(new ConfigService().isConfigured()).toBe(false);
    });

    it('forgets everything on clear', () => {
        const config = new ConfigService();
        config.set(CONNECTION);
        config.clear();

        expect(config.isConfigured()).toBe(false);
        expect(new ConfigService().isConfigured()).toBe(false);
    });

    it('builds a share URL, dropping any fragment or query already there', () => {
        const config = new ConfigService();
        config.set(CONNECTION);
        const url = config.shareUrl(
            'https://fidian.github.io/attendance-tracker/?event=abc#old'
        );

        expect(url?.startsWith('https://fidian.github.io/attendance-tracker/#'))
            .toBe(true);
        expect(deserializeConnection(url || '')).toEqual(CONNECTION);
    });

    it('adopts a connection handed over in a fragment', () => {
        const config = new ConfigService();

        expect(
            config.adoptFromHash(`#${serializeConnection(CONNECTION)}`)
        ).toBe(true);
        expect(config.get()).toEqual(CONNECTION);
    });

    it('leaves a connection alone when the fragment carries none', () => {
        const config = new ConfigService();
        config.set(CONNECTION);

        expect(config.adoptFromHash('#nothing-here')).toBe(false);
        expect(config.get()).toEqual(CONNECTION);
    });

    it('notifies subscribers when the connection changes or is cleared', () => {
        const config = new ConfigService();
        const listener = vi.fn();
        config.subscribe(listener);

        config.set(CONNECTION);
        expect(listener).toHaveBeenLastCalledWith(CONNECTION);

        config.clear();
        expect(listener).toHaveBeenLastCalledWith(null);
    });
});

/**
 * A link sent to somebody already set up would otherwise repoint their phone
 * at the sender's database without a word, and the evening's attendance would
 * be taken into it.
 */
describe('adopting a connection over an existing one', () => {
    const OTHER = {
        databaseUrl: 'https://someone-else-default-rtdb.firebaseio.com',
        groupId: 'ZZZZZZZZZZZZZZZZZZZZZZ',
    };

    beforeEach(() => {
        storage.clear();
    });

    it('adopts silently when the device has nothing yet', () => {
        const config = new ConfigService();

        expect(
            config.adoptFromHash(`#${serializeConnection(CONNECTION)}`)
        ).toBe(true);
        expect(config.get()).toEqual(CONNECTION);
    });

    it('adopts silently when the link matches what is already there', () => {
        const config = new ConfigService();
        config.set(CONNECTION);

        expect(
            config.adoptFromHash(`#${serializeConnection(CONNECTION)}`)
        ).toBe(true);
    });

    it('refuses a different connection unless it is confirmed', () => {
        const config = new ConfigService();
        config.set(CONNECTION);

        expect(config.adoptFromHash(`#${serializeConnection(OTHER)}`)).toBe(
            false
        );
        expect(config.get()).toEqual(CONNECTION);
    });

    it('takes it once confirmed, and says what it is replacing', () => {
        const config = new ConfigService();
        config.set(CONNECTION);
        let asked: [typeof OTHER, typeof CONNECTION] | null = null;

        const adopted = config.adoptFromHash(
            `#${serializeConnection(OTHER)}`,
            (next, current) => {
                asked = [next, current];

                return true;
            }
        );

        expect(adopted).toBe(true);
        expect(asked).toEqual([OTHER, CONNECTION]);
        expect(config.get()).toEqual(OTHER);
    });

    it('asks when only the group differs, not just the database', () => {
        const config = new ConfigService();
        config.set(CONNECTION);
        const sameDbOtherGroup = {
            ...CONNECTION,
            groupId: 'QQQQQQQQQQQQQQQQQQQQQQ',
        };

        expect(
            config.adoptFromHash(`#${serializeConnection(sameDbOtherGroup)}`)
        ).toBe(false);
    });
});
