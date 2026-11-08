import { describe, expect, it } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import { readSheet } from 'read-excel-file/node';
import {
    reportToRows,
    rosterToRows,
    rowsToPeople,
} from './sheet.service';
import type { Person } from './roster.service';

/**
 * The browser writes with `write-excel-file/browser` and reads with
 * `read-excel-file/browser`; these are the same libraries through their Node
 * entry points, so a real .xlsx is produced and parsed here rather than
 * taking the format on trust. Only the download itself needs a DOM.
 */
const roundTrip = async (rows: string[][]): Promise<string[][]> => {
    const buffer = await writeXlsxFile(
        rows.map(row => row.map(value => ({ value, type: String })))
    ).toBuffer();
    const read = await readSheet(buffer);

    return read.map(row =>
        row.map(cell => (cell === null || cell === undefined ? '' : String(cell)))
    );
};

const person = (
    id: string,
    display: string,
    extra: Record<string, string> = {},
    present = false
): Person => ({ id, display, extra, present });

describe('a real xlsx round trip', () => {
    it('gives back the roster that went in', async () => {
        const people = [
            person('p1', 'Harry P.', { First: 'Harry', Dept: 'Auror' }, true),
            person('p2', 'Hermione G.', { First: 'Hermione', Dept: 'Law' }),
        ];
        const back = rowsToPeople(await roundTrip(rosterToRows(people, ['First', 'Dept'])));

        expect(back.columns).toEqual(['First', 'Dept']);
        expect(back.people.map(p => p.display)).toEqual([
            'Harry P.',
            'Hermione G.',
        ]);
        expect(back.people[0].extra).toEqual({ First: 'Harry', Dept: 'Auror' });
    });

    /**
     * The whole reason every cell is written as text. Left to guess, a
     * spreadsheet turns 007 into 7 and 3-4 into a date.
     */
    it('keeps leading zeros and things that look like dates', async () => {
        const people = [
            person('p1', '007 Bond', { Code: '0012', Range: '3-4' }),
        ];
        const back = rowsToPeople(await roundTrip(rosterToRows(people, ['Code', 'Range'])));

        expect(back.people[0].display).toBe('007 Bond');
        expect(back.people[0].extra).toEqual({ Code: '0012', Range: '3-4' });
    });

    it('keeps commas, quotes and unicode', async () => {
        const people = [
            person('p1', 'Zoe, the elder', { Note: 'He said "hi"' }),
            person('p2', 'Zoë Ñuñez 日本', { Note: 'ok' }),
        ];
        const back = rowsToPeople(await roundTrip(rosterToRows(people, ['Note'])));

        expect(back.people.map(p => p.display)).toEqual([
            'Zoe, the elder',
            'Zoë Ñuñez 日本',
        ]);
        expect(back.people[0].extra.Note).toBe('He said "hi"');
    });

    it('a formula-looking name survives and stays inert', async () => {
        const back = rowsToPeople(
            await roundTrip(rosterToRows([person('p1', '=cmd|calc')], []))
        );

        expect(back.people[0].display).toBe('=cmd|calc');
    });

    it('carries the attendance report, present column and all', async () => {
        const people = [
            person('p1', 'Harry P.', { Dept: 'Auror' }, true),
            person('p2', 'Ron W.', { Dept: 'Auror' }, false),
        ];
        const rows = await roundTrip(reportToRows(people, ['Dept']));

        expect(rows[0]).toEqual(['Present', 'Display', 'Dept']);
        expect(rows[1]).toEqual(['Yes', 'Harry P.', 'Auror']);
        expect(rows[2]).toEqual(['No', 'Ron W.', 'Auror']);
    });
});
