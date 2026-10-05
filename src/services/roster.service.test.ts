import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROSTER_LIMIT } from '../config';
import { normalizeName, RosterService } from './roster.service';
import type { Person } from './roster.service';
import { storage } from './local-storage.service';

const person = (label: string, values: Record<string, string> = {}): Person => ({
    label,
    values,
});

const peopleUpTo = (count: number) =>
    Array.from({ length: count }, (_v, i) =>
        person(`Scout ${String(i + 1).padStart(3, '0')}`)
    );

const labels = (roster: RosterService) =>
    roster.getPeople().map(p => p.label);

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
        expect(new RosterService().getPeople()).toEqual([]);
    });

    it('keeps people alphabetical by label however they arrive', () => {
        const roster = new RosterService();
        roster.add(person('Zoe'));
        roster.add(person('ada'));
        roster.add(person('Mabel'));

        expect(labels(roster)).toEqual(['ada', 'Mabel', 'Zoe']);
    });

    it('keeps the field values alongside the label', () => {
        const roster = new RosterService();
        roster.add(
            person('Claude (123)', { First: 'Claude', Troop: '123' })
        );

        expect(roster.find('claude (123)')?.values).toEqual({
            First: 'Claude',
            Troop: '123',
        });
    });

    it('treats labels differing only by case or spacing as one person', () => {
        const roster = new RosterService();
        expect(roster.add(person('Ada Byron'))).toBe('added');
        expect(roster.add(person('ada   byron'))).toBe('known');
        expect(labels(roster)).toEqual(['Ada Byron']);
    });

    it('distinguishes two people who share a first name', () => {
        const roster = new RosterService();
        roster.add(person('Claude (123)', { Troop: '123' }));
        roster.add(person('Claude (456)', { Troop: '456' }));

        expect(labels(roster)).toEqual(['Claude (123)', 'Claude (456)']);
    });

    it('ignores a blank label', () => {
        const roster = new RosterService();
        expect(roster.add(person('   '))).toBe('known');
        expect(roster.getPeople()).toEqual([]);
    });

    it(`refuses someone past ${ROSTER_LIMIT} rather than dropping anyone`, () => {
        const roster = new RosterService();
        roster.replaceAll(peopleUpTo(ROSTER_LIMIT));

        expect(roster.isFull()).toBe(true);
        expect(roster.add(person('Newcomer'))).toBe('full');
        expect(roster.getPeople()).toHaveLength(ROSTER_LIMIT);
    });

    it('takes someone again once room is made', () => {
        const roster = new RosterService();
        roster.replaceAll(peopleUpTo(ROSTER_LIMIT));
        roster.remove('Scout 001');

        expect(roster.add(person('Newcomer'))).toBe('added');
    });

    it('removes someone whatever the capitalization', () => {
        const roster = new RosterService();
        roster.add(person('Ada'));
        roster.add(person('Zoe'));
        roster.remove('ADA');

        expect(labels(roster)).toEqual(['Zoe']);
    });

    it('replaces the whole roster on import and reports what was dropped', () => {
        const roster = new RosterService();
        roster.add(person('Leftover'));

        expect(roster.replaceAll([person('Ada'), person('Zoe')])).toBe(0);
        expect(labels(roster)).toEqual(['Ada', 'Zoe']);
    });

    it('reports how many an oversized import lost', () => {
        const roster = new RosterService();

        expect(roster.replaceAll(peopleUpTo(ROSTER_LIMIT + 7))).toBe(7);
        expect(roster.getPeople()).toHaveLength(ROSTER_LIMIT);
    });

    it('collapses duplicate labels within one import', () => {
        const roster = new RosterService();
        roster.replaceAll([person('Ada'), person('ADA'), person('Zoe')]);

        expect(labels(roster)).toEqual(['Ada', 'Zoe']);
    });

    it('persists across instances, still sorted', () => {
        const first = new RosterService();
        first.add(person('Zoe', { Troop: '1' }));
        first.add(person('Ada'));

        const second = new RosterService();
        expect(labels(second)).toEqual(['Ada', 'Zoe']);
        expect(second.find('Zoe')?.values).toEqual({ Troop: '1' });
    });

    it('ignores a stored value written to the old string-list shape', () => {
        storage.setItem('roster', JSON.stringify([1, ['Ada', 'Zoe']]));

        expect(new RosterService().getPeople()).toEqual([]);
    });

    it('notifies subscribers until they unsubscribe', () => {
        const roster = new RosterService();
        const listener = vi.fn();
        const unsubscribe = roster.subscribe(listener);

        roster.add(person('Ada'));
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        roster.add(person('Zoe'));
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
