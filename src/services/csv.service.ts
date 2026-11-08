/**
 * Reading and writing CSV. Hand-written because a dependency for this much
 * code is a poor trade, and because the reader predates everything else here
 * and has the tests to prove it works.
 */

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
