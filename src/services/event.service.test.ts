import { describe, expect, it } from 'vitest';
import {
    byNewest,
    defaultEventName,
    toEvent,
    toEvents,
} from './event.service';
import type { AttendanceEvent } from './event.service';

const stored = (name: string, createdAt = 1000, columns: unknown = []) => ({
    name,
    createdAt,
    columns,
});

describe('toEvent', () => {
    it('reads a stored event', () => {
        expect(toEvent('e1', stored('Troop Meeting', 1700, ['First', 'Dept']))).toEqual(
            {
                id: 'e1',
                name: 'Troop Meeting',
                columns: ['First', 'Dept'],
                createdAt: 1700,
            }
        );
    });

    it('trims the name', () => {
        expect(toEvent('e1', stored('  Meeting  '))?.name).toBe('Meeting');
    });

    it('defaults missing columns and date', () => {
        expect(toEvent('e1', { name: 'Meeting' })).toEqual({
            id: 'e1',
            name: 'Meeting',
            columns: [],
            createdAt: 0,
        });
    });

    /** Columns are written as an array but can come back as anything. */
    it('keeps only string columns, whatever the stored shape', () => {
        expect(toEvent('e1', stored('M', 1, ['A', 7, null, 'B']))?.columns).toEqual(
            ['A', 'B']
        );
        expect(toEvent('e1', stored('M', 1, 'nope'))?.columns).toEqual([]);
        expect(toEvent('e1', stored('M', 1, { 0: 'A' }))?.columns).toEqual([]);
    });

    it('skips a record with no usable name', () => {
        for (const raw of [null, 'x', 7, {}, { name: '' }, { name: '  ' }, { name: 5 }]) {
            expect(toEvent('e1', raw)).toBeNull();
        }
    });
});

describe('toEvents', () => {
    it('lists newest first', () => {
        const events = toEvents({
            e1: stored('Older', 1000),
            e2: stored('Newer', 2000),
        });

        expect(events.map(e => e.name)).toEqual(['Newer', 'Older']);
    });

    it('breaks a tie by name so the order never flickers', () => {
        const events = toEvents({
            e1: stored('Zoe night', 5),
            e2: stored('Archery', 5),
        });

        expect(events.map(e => e.name)).toEqual(['Archery', 'Zoe night']);
    });

    it('drops unreadable records rather than failing', () => {
        expect(
            toEvents({ e1: stored('Good'), e2: null, e3: { nope: 1 } }).map(e => e.name)
        ).toEqual(['Good']);
    });

    it('is empty for anything that is not a record', () => {
        for (const raw of [null, undefined, 'x', 7]) {
            expect(toEvents(raw)).toEqual([]);
        }
    });
});

describe('byNewest', () => {
    it('puts an event with no date last', () => {
        const make = (name: string, createdAt: number): AttendanceEvent => ({
            id: name,
            name,
            columns: [],
            createdAt,
        });
        const sorted = [make('old', 0), make('new', 10)].sort(byNewest);

        expect(sorted.map(e => e.name)).toEqual(['new', 'old']);
    });
});

describe('defaultEventName', () => {
    it('is the date then the label', () => {
        expect(defaultEventName(new Date(2026, 10, 8), 'Sample Event')).toBe(
            '2026-11-08 Sample Event'
        );
    });

    it('pads single-digit months and days', () => {
        expect(defaultEventName(new Date(2026, 0, 3), 'Meeting')).toBe(
            '2026-01-03 Meeting'
        );
    });

    /** Sorting is by stored date, but the name should sort sensibly too. */
    it('produces names that sort chronologically as text', () => {
        const names = [
            defaultEventName(new Date(2026, 10, 8), 'M'),
            defaultEventName(new Date(2026, 0, 3), 'M'),
            defaultEventName(new Date(2025, 11, 31), 'M'),
        ];

        expect([...names].sort()).toEqual([
            '2025-12-31 M',
            '2026-01-03 M',
            '2026-11-08 M',
        ]);
    });
});
