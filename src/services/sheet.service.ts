import { parseCsv } from './csv.service';
import { ROSTER_LIMIT } from '../config';
import type { NewPerson, Person } from './roster.service';
import { normalizeName } from './roster.service';

export interface SheetImport {
    people: NewPerson[];
    /** Header order, which an export has to reproduce. */
    columns: string[];
    /** Headings seen more than once; the later one is dropped. */
    duplicateColumns: string[];
    /** Rows past the limit, left out. */
    dropped: number;
}

/** What the report's leading column says. */
export const PRESENT_YES = 'Yes';
export const PRESENT_NO = 'No';

/**
 * A cell that Excel would treat as a formula rather than text.
 *
 * These files are made to be opened in a spreadsheet, so a person whose name
 * begins with one of these characters is a code-execution prompt waiting for
 * somebody to click through a warning. Prefixing with an apostrophe makes
 * Excel show the text and run nothing; the apostrophe is not part of the
 * value and comes back off on import.
 */
const RISKY_FIRST = /^[=+\-@\t\r]/;

export const escapeCell = (value: string) =>
    RISKY_FIRST.test(value) ? `'${value}` : value;

export const unescapeCell = (value: string) =>
    value.startsWith("'") && RISKY_FIRST.test(value.slice(1))
        ? value.slice(1)
        : value;

/** RFC 4180: quote when the value could otherwise be misread. */
export const toCsvCell = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const toCsv = (rows: string[][]) =>
    rows.map(row => row.map(toCsvCell).join(',')).join('\r\n');

/**
 * Header plus one row per person, in the event's remembered column order.
 *
 * The headings are escaped along with everything else: they come from
 * whatever file was imported, so a roster shared between leaders can carry a
 * hostile one just as easily as a hostile name.
 */
export const rosterToRows = (
    people: Person[],
    columns: string[]
): string[][] => [
    ['Display', ...columns.map(escapeCell)],
    ...people.map(person => [
        escapeCell(person.display),
        ...columns.map(column => escapeCell(person.extra[column] ?? '')),
    ]),
];

/** The roster with one more column at the front saying who was present. */
export const reportToRows = (
    people: Person[],
    columns: string[]
): string[][] => {
    const [header, ...body] = rosterToRows(people, columns);

    return [
        ['Present', ...header],
        ...body.map((row, index) => [
            people[index].present ? PRESENT_YES : PRESENT_NO,
            ...row,
        ]),
    ];
};

/**
 * The first column is the display name; every other column is remembered and
 * handed back on export but never shown. A heading seen twice would collapse
 * into one key, so the repeat is dropped and reported rather than silently
 * losing a column.
 */
export const rowsToPeople = (rows: string[][]): SheetImport => {
    const [header = [], ...body] = rows;
    const columns: string[] = [];
    const duplicateColumns: string[] = [];
    const used = new Set<string>();
    const indexOfColumn = new Map<number, string>();

    header.forEach((raw, index) => {
        if (index === 0) {
            return;
        }

        const name = unescapeCell((raw || '').trim());

        if (!name) {
            return;
        }

        if (used.has(name.toLowerCase())) {
            duplicateColumns.push(name);

            return;
        }

        used.add(name.toLowerCase());
        columns.push(name);
        indexOfColumn.set(index, name);
    });

    const all = body
        .map(row => {
            const extra: Record<string, string> = {};

            for (const [index, column] of indexOfColumn) {
                extra[column] = unescapeCell((row[index] ?? '').trim());
            }

            return {
                display: normalizeName(unescapeCell((row[0] ?? '').trim())),
                extra,
                present: false,
            };
        })
        .filter(person => !!person.display);

    return {
        people: all.slice(0, ROSTER_LIMIT),
        columns,
        duplicateColumns,
        dropped: Math.max(0, all.length - ROSTER_LIMIT),
    };
};

/** Everything in one group, for the backup file. */
export interface Backup {
    version: 1;
    exportedAt: string;
    events: Record<string, unknown>;
    roster: Record<string, unknown>;
}

export const toBackup = (
    events: unknown,
    roster: unknown,
    now = new Date()
): Backup => ({
    version: 1,
    exportedAt: now.toISOString(),
    events: (events as Record<string, unknown>) || {},
    roster: (roster as Record<string, unknown>) || {},
});

export const fromBackup = (raw: unknown): Backup | null => {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const backup = raw as Partial<Backup>;

    if (backup.version !== 1 || !backup.events || typeof backup.events !== 'object') {
        return null;
    }

    return {
        version: 1,
        exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
        events: backup.events as Record<string, unknown>,
        roster:
            backup.roster && typeof backup.roster === 'object'
                ? (backup.roster as Record<string, unknown>)
                : {},
    };
};

/** A filename a spreadsheet will not argue with. */
export const safeFilename = (name: string, extension: string) => {
    const base = name
        .replace(/[^A-Za-z0-9 _-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);

    return `${base || 'attendance'}.${extension}`;
};

export class SheetService {
    /** Reads whichever of the two formats the file turns out to be. */
    async read(file: File): Promise<string[][]> {
        if (/\.xlsx?$/i.test(file.name)) {
            return this._readXlsx(file);
        }

        return parseCsv(await file.text());
    }

    downloadCsv(filename: string, rows: string[][]) {
        // A byte-order mark is what makes Excel open UTF-8 as UTF-8.
        this._download(
            `﻿${toCsv(rows)}`,
            safeFilename(filename, 'csv'),
            'text/csv;charset=utf-8'
        );
    }

    /**
     * Every cell is written as text on purpose. Left to guess, a spreadsheet
     * turns "007" into 7 and a name like "3-4" into a date, and the roster
     * that comes back out is not the one that went in.
     */
    async downloadXlsx(filename: string, rows: string[][]) {
        const { default: writeXlsxFile } = await import('write-excel-file/browser');
        const output = writeXlsxFile(
            rows.map(row => row.map(value => ({ value, type: String })))
        );
        await output.toFile(safeFilename(filename, 'xlsx'));
    }

    downloadJson(filename: string, value: unknown) {
        this._download(
            JSON.stringify(value, null, 2),
            safeFilename(filename, 'json'),
            'application/json'
        );
    }

    /**
     * Loaded only when a spreadsheet is actually read, the way the barcode
     * decoder is, so it never lands in the bundle somebody downloads just to
     * tap a name.
     */
    private async _readXlsx(file: File): Promise<string[][]> {
        // `readSheet` gives the first sheet's rows; the default export wraps
        // every sheet in an object and this app only ever wants one.
        const { readSheet } = await import('read-excel-file/browser');
        const rows = await readSheet(file);

        return rows.map(row =>
            row.map(cell =>
                cell === null || cell === undefined ? '' : String(cell)
            )
        );
    }

    private _download(text: string, filename: string, type: string) {
        this._save(new Blob([text], { type }), filename);
    }

    private _save(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Revoking immediately can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
}
