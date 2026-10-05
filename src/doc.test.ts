import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFormUrl } from './services/config.service';

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

/**
 * The worked example's pre-filled link, not the generic illustration earlier
 * in the file -- that one uses made-up entry ids.
 */
const prefilled = () => {
    const match = /(https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdKYU[^\s`]+)/.exec(
        README
    );

    expect(match, 'the worked example lost its pre-filled link').not.toBeNull();

    return match![1];
};

/**
 * The worked example prints the pre-filled link and then a table of what the
 * app makes of it. Those are two copies of the same facts, and editing one
 * without the other is the easy mistake -- the README would then teach
 * something the app does not do. This reads the link with the app's own
 * parser and checks the table against it. The live sheet is deliberately not
 * fetched: a test that depends on somebody's spreadsheet fails for reasons
 * that have nothing to do with this repository.
 */
describe('the worked example in README.md', () => {
    it('has a table matching what the parser gets from its own link', () => {
        const fields = parseFormUrl(prefilled()).fields;
        expect(fields.length).toBeGreaterThan(0);

        // Each row is `| `Label` | `entry.N` |`, so the pairing is checked,
        // not merely that both words appear somewhere in the file.
        const rows = [
            ...README.matchAll(/\|\s*`([^`]+)`\s*\|\s*`entry\.(\d+)`\s*\|/g),
        ].map(m => ({ label: m[1], id: m[2] }));

        expect(rows).toEqual(fields.map(f => ({ label: f.label, id: f.id })));
    });

    it('spells the sheet headings the way the questions are named', () => {
        const labels = parseFormUrl(prefilled()).fields.map(f => f.label);
        const header = /\|\s*Display\s*\|([^\n]*)\|/.exec(README);

        expect(header, 'the worked example lost its sheet table').not.toBeNull();

        const headings = header![1]
            .split('|')
            .map(cell => cell.trim())
            .filter(Boolean);

        expect(headings).toEqual(labels);
    });
});
