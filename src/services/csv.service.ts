import type { Person } from './roster.service';

export interface CsvImport {
    people: Person[];
    /** Headers in the file that match no form field, so nothing sends them. */
    unmatchedColumns: string[];
    /** Form fields with no column, which Google rejects if it requires them. */
    missingFields: string[];
}

/**
 * A small RFC 4180 reader: quoted fields, doubled quotes inside them, commas
 * and newlines inside quotes, and either line ending. Hand-written because a
 * dependency for thirty lines is a poor trade in an app this size.
 */
export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    let i = 0;
    // A byte-order mark survives a round trip through Sheets and would
    // otherwise become part of the first header.
    const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

    const endCell = () => {
        row.push(cell);
        cell = '';
    };
    const endRow = () => {
        endCell();

        if (row.some(value => value !== '')) {
            rows.push(row);
        }

        row = [];
    };

    while (i < body.length) {
        const char = body[i];

        if (quoted) {
            if (char === '"') {
                if (body[i + 1] === '"') {
                    cell += '"';
                    i += 2;
                    continue;
                }

                quoted = false;
                i++;
                continue;
            }

            cell += char;
            i++;
            continue;
        }

        if (char === '"') {
            quoted = true;
            i++;
        } else if (char === ',') {
            endCell();
            i++;
        } else if (char === '\r') {
            i++;
        } else if (char === '\n') {
            endRow();
            i++;
        } else {
            cell += char;
            i++;
        }
    }

    if (cell !== '' || row.length) {
        endRow();
    }

    return rows;
};

export class CsvService {
    /**
     * Turns a sheet into roster rows. The first column is what the list
     * shows; every other column fills the form field whose label matches its
     * header, ignoring case and surrounding space.
     *
     * The field labels are passed in rather than read from the saved
     * settings, so importing works against the questions currently on the
     * setup screen whether or not Save has been pressed yet.
     */
    toPeople(rows: string[][], labels: string[]): CsvImport {
        const [header = [], ...body] = rows;
        const byHeader = new Map<number, string>();
        const unmatchedColumns: string[] = [];

        header.forEach((name, column) => {
            if (column === 0) {
                return;
            }

            const trimmed = name.trim();
            const field = labels.find(
                label => label.toLowerCase() === trimmed.toLowerCase()
            );

            if (field) {
                byHeader.set(column, field);
            } else if (trimmed) {
                unmatchedColumns.push(trimmed);
            }
        });

        const people = body
            .map(row => {
                const values: Record<string, string> = {};

                for (const [column, field] of byHeader) {
                    values[field] = (row[column] || '').trim();
                }

                return { label: (row[0] || '').trim(), values };
            })
            .filter(person => !!person.label);

        const matched = [...byHeader.values()];

        return {
            people,
            unmatchedColumns,
            missingFields: labels.filter(label => !matched.includes(label)),
        };
    }

    /**
     * Published-to-web sheets answer with permissive CORS headers, which is
     * what lets a page with no backend read one at all. A sheet that is
     * merely shared by link does not, and fails here.
     */
    async fetchPeople(url: string, labels: string[]): Promise<CsvImport> {
        let response: Response;

        try {
            response = await fetch(url, { redirect: 'follow' });
        } catch (_ignore) {
            throw new Error(
                'Could not read that address. It has to be a sheet published to the web, not just shared by link.'
            );
        }

        if (!response.ok) {
            throw new Error(
                `The sheet answered with ${response.status}. Check that it is still published to the web.`
            );
        }

        const text = await response.text();

        if (/^\s*</.test(text)) {
            throw new Error(
                'That address returned a web page, not a CSV. Use the "Publish to web" link and pick CSV.'
            );
        }

        const result = this.toPeople(parseCsv(text), labels);

        if (!result.people.length) {
            throw new Error('No rows with a name in the first column.');
        }

        return result;
    }
}
