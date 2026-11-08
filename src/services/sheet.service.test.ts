import { describe, expect, it } from 'vitest';
import {
    escapeCell,
    fromBackup,
    PRESENT_NO,
    PRESENT_YES,
    reportToRows,
    rosterToRows,
    rowsToPeople,
    safeFilename,
    toBackup,
    toCsv,
    unescapeCell,
} from './sheet.service';
import { parseCsv } from './csv.service';
import type { Person } from './roster.service';

const person = (
    id: string,
    display: string,
    extra: Record<string, string> = {},
    present = false
): Person => ({ id, display, extra, present });

const ROSTER = [
    person('p1', 'Harry P.', { First: 'Harry', Dept: 'Auror' }, true),
    person('p2', 'Hermione G.', { First: 'Hermione', Dept: 'Law' }),
];
const COLUMNS = ['First', 'Dept'];

describe('escapeCell / unescapeCell', () => {
    /**
     * These files are opened in Excel, so a leading = is a formula. This is
     * the one place a roster can carry something dangerous.
     */
    it('defuses every character Excel treats as a formula', () => {
        for (const value of ['=cmd|\'/c calc\'!A1', '+1+1', '-2+3', '@SUM(A1)']) {
            expect(escapeCell(value).startsWith("'")).toBe(true);
            expect(unescapeCell(escapeCell(value))).toBe(value);
        }
    });

    it('leaves an ordinary name alone', () => {
        for (const value of ['Harry P.', "O'Brien", 'Zoe, the elder', '007']) {
            expect(escapeCell(value)).toBe(value);
            expect(unescapeCell(value)).toBe(value);
        }
    });

    it('does not strip an apostrophe that belongs to the name', () => {
        expect(unescapeCell("'Tis Himself")).toBe("'Tis Himself");
    });
});

describe('toCsv', () => {
    it('quotes only what needs it', () => {
        expect(toCsv([['a', 'b,c', 'd"e', 'f\ng']])).toBe(
            'a,"b,c","d""e","f\ng"'
        );
    });

    it('round trips through the reader', () => {
        const rows = [
            ['Display', 'First'],
            ['Zoe, the elder', 'Zoe'],
            ['He said "hi"', 'X'],
            ['two\nlines', 'Y'],
        ];

        expect(parseCsv(toCsv(rows))).toEqual(rows);
    });
});

describe('rosterToRows', () => {
    it('is the display name then the remembered columns in order', () => {
        expect(rosterToRows(ROSTER, COLUMNS)).toEqual([
            ['Display', 'First', 'Dept'],
            ['Harry P.', 'Harry', 'Auror'],
            ['Hermione G.', 'Hermione', 'Law'],
        ]);
    });

    it('writes an empty cell for a column a person has no value for', () => {
        expect(rosterToRows([person('p1', 'Ada')], COLUMNS)[1]).toEqual([
            'Ada',
            '',
            '',
        ]);
    });

    it('ignores extras that are not remembered columns', () => {
        const rows = rosterToRows([person('p1', 'Ada', { Secret: 'x' })], COLUMNS);

        expect(rows[1]).toEqual(['Ada', '', '']);
    });
});

describe('reportToRows', () => {
    it('adds one column at the front and keeps everything else', () => {
        expect(reportToRows(ROSTER, COLUMNS)).toEqual([
            ['Present', 'Display', 'First', 'Dept'],
            [PRESENT_YES, 'Harry P.', 'Harry', 'Auror'],
            [PRESENT_NO, 'Hermione G.', 'Hermione', 'Law'],
        ]);
    });

    /** Yes/No rather than TRUE/FALSE: it is read by people, in a spreadsheet. */
    it('says yes and no', () => {
        expect(PRESENT_YES).toBe('Yes');
        expect(PRESENT_NO).toBe('No');
    });
});

describe('rowsToPeople', () => {
    it('takes the first column as the name and remembers the rest', () => {
        const result = rowsToPeople([
            ['Display', 'First', 'Dept'],
            ['Harry P.', 'Harry', 'Auror'],
        ]);

        expect(result.columns).toEqual(['First', 'Dept']);
        expect(result.people).toEqual([
            {
                display: 'Harry P.',
                extra: { First: 'Harry', Dept: 'Auror' },
                present: false,
            },
        ]);
    });

    it('skips rows with no name, and blank headings', () => {
        const result = rowsToPeople([
            ['Display', 'First', '', 'Dept'],
            ['Ada', 'A', 'ignored', 'Law'],
            ['', 'B', 'x', 'y'],
        ]);

        expect(result.columns).toEqual(['First', 'Dept']);
        expect(result.people).toHaveLength(1);
        expect(result.people[0].extra).toEqual({ First: 'A', Dept: 'Law' });
    });

    /** Two columns with one heading would collapse into a single key. */
    it('drops a repeated heading and says which', () => {
        const result = rowsToPeople([
            ['Display', 'Dept', 'dept'],
            ['Ada', 'Law', 'Other'],
        ]);

        expect(result.columns).toEqual(['Dept']);
        expect(result.duplicateColumns).toEqual(['dept']);
        expect(result.people[0].extra).toEqual({ Dept: 'Law' });
    });

    it('undoes the formula escaping on the way back in', () => {
        const result = rowsToPeople([
            ['Display', 'Note'],
            ["'=cmd", "'+1"],
        ]);

        expect(result.people[0].display).toBe('=cmd');
        expect(result.people[0].extra.Note).toBe('+1');
    });

    it('normalizes whitespace in the name', () => {
        expect(
            rowsToPeople([['Display'], ['  Ada   Byron ']]).people[0].display
        ).toBe('Ada Byron');
    });

    it('survives an empty sheet', () => {
        expect(rowsToPeople([]).people).toEqual([]);
        expect(rowsToPeople([['Display']]).people).toEqual([]);
    });
});

describe('the full CSV round trip', () => {
    it('gives back exactly what went in, column order included', () => {
        const out = rosterToRows(ROSTER, COLUMNS);
        const back = rowsToPeople(parseCsv(toCsv(out)));

        expect(back.columns).toEqual(COLUMNS);
        expect(back.people.map(p => p.display)).toEqual([
            'Harry P.',
            'Hermione G.',
        ]);
        expect(back.people[0].extra).toEqual({ First: 'Harry', Dept: 'Auror' });
    });

    /** The cases that quietly corrupt a roster if nobody looks. */
    it('keeps leading zeros, commas, quotes, unicode and formulas', () => {
        const tricky = [
            person('p1', '007 Bond', { Note: '0012' }),
            person('p2', 'Zoe, the elder', { Note: 'He said "hi"' }),
            person('p3', 'Zoë Ñuñez 日本', { Note: 'ok' }),
            person('p4', '=cmd|calc', { Note: '-1' }),
        ];
        const back = rowsToPeople(
            parseCsv(toCsv(rosterToRows(tricky, ['Note'])))
        );

        expect(back.people.map(p => p.display)).toEqual([
            '007 Bond',
            'Zoe, the elder',
            'Zoë Ñuñez 日本',
            '=cmd|calc',
        ]);
        expect(back.people.map(p => p.extra.Note)).toEqual([
            '0012',
            'He said "hi"',
            'ok',
            '-1',
        ]);
    });

    it('does not lose two people who share a display name', () => {
        const back = rowsToPeople(
            parseCsv(
                toCsv(
                    rosterToRows(
                        [person('p1', 'Sam', { Dept: 'A' }), person('p2', 'Sam', { Dept: 'B' })],
                        ['Dept']
                    )
                )
            )
        );

        expect(back.people).toHaveLength(2);
        expect(back.people.map(p => p.extra.Dept)).toEqual(['A', 'B']);
    });
});

describe('backup', () => {
    it('round trips', () => {
        const backup = toBackup({ e1: { name: 'M' } }, { e1: { p1: {} } });

        expect(fromBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
    });

    it('records when it was taken', () => {
        expect(toBackup({}, {}, new Date('2026-11-08T10:00:00Z')).exportedAt)
            .toBe('2026-11-08T10:00:00.000Z');
    });

    it('refuses a file that is not one of ours', () => {
        for (const raw of [null, 'x', 7, {}, { version: 2, events: {} }, { version: 1 }]) {
            expect(fromBackup(raw)).toBeNull();
        }
    });

    it('tolerates a backup with no roster at all', () => {
        expect(fromBackup({ version: 1, events: {} })?.roster).toEqual({});
    });
});

describe('safeFilename', () => {
    it('keeps a readable name and adds the extension', () => {
        expect(safeFilename('2026-11-08 Meeting', 'csv')).toBe(
            '2026-11-08 Meeting.csv'
        );
    });

    it('strips characters a filesystem would argue with', () => {
        expect(safeFilename('a/b\\c:d*e?"<>|', 'xlsx')).toBe('a b c d e.xlsx');
    });

    it('falls back when nothing usable is left', () => {
        expect(safeFilename('///', 'csv')).toBe('attendance.csv');
    });
});
