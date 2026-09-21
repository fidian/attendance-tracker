import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RECENT_NAME_LIMIT } from '../config';
import { normalizeName, RosterService } from './roster.service';
import { storage } from './local-storage.service';

const namesUpTo = (count: number) =>
    Array.from({ length: count }, (_value, index) => `Scout ${index + 1}`);

describe('normalizeName', () => {
    it('trims and collapses whitespace', () => {
        expect(normalizeName('  Ada   Byron \n')).toBe('Ada Byron');
    });
});

describe('RosterService', () => {
    beforeEach(() => {
        storage.clear();
    });

    it('starts empty', () => {
        expect(new RosterService().getNames()).toEqual([]);
    });

    it('keeps names in alphabetical order however they arrive', () => {
        const roster = new RosterService();
        roster.add('Zoe');
        roster.add('ada');
        roster.add('Mabel');

        expect(roster.getNames()).toEqual(['ada', 'Mabel', 'Zoe']);
    });

    it('sorts without regard to case', () => {
        const roster = new RosterService();
        roster.add('bob');
        roster.add('Alice');
        roster.add('carol');

        expect(roster.getNames()).toEqual(['Alice', 'bob', 'carol']);
    });

    it('does not move a name when it is marked; there is nothing to move', () => {
        const roster = new RosterService();
        roster.add('Ada');
        roster.add('Zoe');
        const before = roster.getNames().slice();
        roster.add('Zoe');

        expect(roster.getNames()).toEqual(before);
    });

    it('treats names differing only by case or spacing as the same person', () => {
        const roster = new RosterService();
        expect(roster.add('Ada Byron')).toBe('added');
        expect(roster.add('ada   byron')).toBe('known');
        expect(roster.getNames()).toEqual(['Ada Byron']);
    });

    it('ignores blank names', () => {
        const roster = new RosterService();
        roster.add('Ada');
        expect(roster.add('   ')).toBe('known');

        expect(roster.getNames()).toEqual(['Ada']);
    });

    it(`refuses a name past ${RECENT_NAME_LIMIT} rather than dropping one`, () => {
        const roster = new RosterService();

        for (const name of namesUpTo(RECENT_NAME_LIMIT)) {
            expect(roster.add(name)).toBe('added');
        }

        expect(roster.isFull()).toBe(true);
        expect(roster.add('Newcomer')).toBe('full');
        expect(roster.getNames()).toHaveLength(RECENT_NAME_LIMIT);
        expect(roster.getNames()).not.toContain('Newcomer');
    });

    it('takes a new name again once room is made', () => {
        const roster = new RosterService();

        for (const name of namesUpTo(RECENT_NAME_LIMIT)) {
            roster.add(name);
        }

        roster.remove('Scout 1');

        expect(roster.add('Newcomer')).toBe('added');
        expect(roster.getNames()).toContain('Newcomer');
    });

    it('removes a name whatever its capitalization', () => {
        const roster = new RosterService();
        roster.add('Ada');
        roster.add('Grace');
        roster.remove('ADA');

        expect(roster.getNames()).toEqual(['Grace']);
    });

    it('reports whether a name is already listed', () => {
        const roster = new RosterService();
        roster.add('Ada Byron');

        expect(roster.has('ada  byron')).toBe(true);
        expect(roster.has('Grace')).toBe(false);
    });

    it('persists the list across instances, still sorted', () => {
        const first = new RosterService();
        first.add('Zoe');
        first.add('Ada');

        expect(new RosterService().getNames()).toEqual(['Ada', 'Zoe']);
    });

    it('sorts a stored list and drops blanks and duplicates', () => {
        storage.setItem(
            'recentNames',
            JSON.stringify([1, ['Zoe', 'zoe', '', 'Ada', '  Mabel  ']])
        );

        expect(new RosterService().getNames()).toEqual([
            'Ada',
            'Mabel',
            'Zoe',
        ]);
    });

    it('trims a stored list that is longer than the limit', () => {
        storage.setItem(
            'recentNames',
            JSON.stringify([1, [...namesUpTo(RECENT_NAME_LIMIT), 'Zoe']])
        );

        const names = new RosterService().getNames();
        expect(names).toHaveLength(RECENT_NAME_LIMIT);
        // Sorting happens before the cut, so the tail goes.
        expect(names).not.toContain('Zoe');
    });

    it('ignores a stored value that is not a list of strings', () => {
        storage.setItem('recentNames', JSON.stringify([1, { nope: true }]));

        expect(new RosterService().getNames()).toEqual([]);
    });

    it('notifies subscribers until they unsubscribe', () => {
        const roster = new RosterService();
        const listener = vi.fn();
        const unsubscribe = roster.subscribe(listener);

        roster.add('Ada');
        expect(listener).toHaveBeenCalledWith(['Ada']);

        unsubscribe();
        roster.add('Grace');
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
