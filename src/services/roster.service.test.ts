import { describe, expect, it } from 'vitest';
import {
    byDisplay,
    forCopy,
    fromPerson,
    normalizeName,
    RosterTable,
    toPeople,
    toPerson,
} from './roster.service';
import type { Person } from './roster.service';

const stored = (display: string, extra = {}, present = false) => ({
    display,
    extra,
    present,
});

describe('normalizeName', () => {
    it('trims and collapses whitespace', () => {
        expect(normalizeName('  Ada   Byron \n')).toBe('Ada Byron');
    });
});

describe('toPerson', () => {
    it('reads a stored person', () => {
        expect(toPerson('p1', stored('Harry P.', { First: 'Harry' }, true))).toEqual(
            {
                id: 'p1',
                display: 'Harry P.',
                extra: { First: 'Harry' },
                present: true,
            }
        );
    });

    it('defaults a missing present and extra', () => {
        expect(toPerson('p1', { display: 'Ada' })).toEqual({
            id: 'p1',
            display: 'Ada',
            extra: {},
            present: false,
        });
    });

    it('treats anything but true as absent', () => {
        for (const present of ['true', 1, null, undefined, 'yes']) {
            expect(toPerson('p1', { display: 'Ada', present })?.present).toBe(
                false
            );
        }
    });

    /** A sheet column of numbers comes back as numbers, not strings. */
    it('keeps a numeric extra column readable', () => {
        expect(
            toPerson('p1', stored('Ada', { Troop: 123, Active: true }))?.extra
        ).toEqual({ Troop: '123', Active: 'true' });
    });

    it('skips a record with no usable name', () => {
        for (const raw of [null, 'nope', 42, {}, { display: '' }, { display: '   ' }]) {
            expect(toPerson('p1', raw)).toBeNull();
        }
    });

    it('ignores an extra that is not an object', () => {
        expect(toPerson('p1', stored('Ada', 'nope' as never))?.extra).toEqual({});
    });
});

describe('toPeople', () => {
    it('reads a roster alphabetically regardless of key order', () => {
        const people = toPeople({
            p3: stored('Zoe'),
            p1: stored('ada'),
            p2: stored('Mabel'),
        });

        expect(people.map(p => p.display)).toEqual(['ada', 'Mabel', 'Zoe']);
    });

    it('drops unreadable records rather than failing', () => {
        const people = toPeople({ p1: stored('Ada'), p2: null, p3: { nope: 1 } });

        expect(people.map(p => p.display)).toEqual(['Ada']);
    });

    it('is empty for anything that is not a record', () => {
        for (const raw of [null, undefined, 'x', 7]) {
            expect(toPeople(raw)).toEqual([]);
        }
    });
});

describe('byDisplay', () => {
    it('sorts without regard to case', () => {
        const names = ['bob', 'Alice', 'carol'].map((display, i) => ({
            id: `p${i}`,
            display,
            extra: {},
            present: false,
        }));

        expect([...names].sort(byDisplay).map(p => p.display)).toEqual([
            'Alice',
            'bob',
            'carol',
        ]);
    });

    /** Two people really can share a display name; order must still be stable. */
    it('falls back to the id so the order never flickers', () => {
        const a: Person = { id: 'p2', display: 'Sam', extra: {}, present: false };
        const b: Person = { id: 'p1', display: 'Sam', extra: {}, present: false };

        expect([a, b].sort(byDisplay).map(p => p.id)).toEqual(['p1', 'p2']);
        expect([b, a].sort(byDisplay).map(p => p.id)).toEqual(['p1', 'p2']);
    });
});

describe('fromPerson', () => {
    it('writes the normalized name and drops the id', () => {
        expect(
            fromPerson({ display: '  Ada   Byron ', extra: { A: '1' }, present: true })
        ).toEqual({ display: 'Ada Byron', extra: { A: '1' }, present: true });
    });
});

describe('forCopy', () => {
    it('brings the people but not the attendance', () => {
        const people = toPeople({
            p1: stored('Ada', { Dept: 'Law' }, true),
            p2: stored('Zoe', {}, true),
        });

        expect(forCopy(people)).toEqual([
            { display: 'Ada', extra: { Dept: 'Law' }, present: false },
            { display: 'Zoe', extra: {}, present: false },
        ]);
    });

    it('copies the extras rather than sharing them', () => {
        const people = toPeople({ p1: stored('Ada', { Dept: 'Law' }) });
        const copy = forCopy(people);
        copy[0].extra.Dept = 'Changed';

        expect(people[0].extra.Dept).toBe('Law');
    });
});

/** This is where live updates land, so it is tested without a database. */
describe('RosterTable', () => {
    it('starts empty', () => {
        expect(new RosterTable().list()).toEqual([]);
    });

    it('adds, keeps sorted, and reports its size', () => {
        const table = new RosterTable();
        table.upsert('p2', stored('Zoe'));
        table.upsert('p1', stored('Ada'));

        expect(table.list().map(p => p.display)).toEqual(['Ada', 'Zoe']);
        expect(table.size).toBe(2);
    });

    it('replaces a person in place when they change', () => {
        const table = new RosterTable();
        table.upsert('p1', stored('Ada', {}, false));
        table.upsert('p1', stored('Ada', {}, true));

        expect(table.size).toBe(1);
        expect(table.get('p1')?.present).toBe(true);
    });

    it('removes a person', () => {
        const table = new RosterTable();
        table.upsert('p1', stored('Ada'));

        expect(table.remove('p1')).toBe(true);
        expect(table.remove('p1')).toBe(false);
        expect(table.list()).toEqual([]);
    });

    /**
     * A record edited into an unreadable state arrives as a change, not a
     * removal, so it has to drop out rather than linger half-read.
     */
    it('drops a person whose record stops being readable', () => {
        const table = new RosterTable();
        table.upsert('p1', stored('Ada'));
        table.upsert('p1', { display: '' });

        expect(table.list()).toEqual([]);
    });

    it('knows whether a display name is already listed', () => {
        const table = new RosterTable();
        table.upsert('p1', stored('Ada Byron'));

        expect(table.has('ada   byron')).toBe(true);
        expect(table.has('Zoe')).toBe(false);
    });

    it('clears', () => {
        const table = new RosterTable();
        table.upsert('p1', stored('Ada'));
        table.clear();

        expect(table.size).toBe(0);
    });
});
