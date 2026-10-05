import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOCS, PROJECT_URL } from './config';

/** GitHub's heading anchors: lowercased, punctuation dropped, spaces dashed. */
const slug = (heading: string) =>
    heading
        .trim()
        .toLowerCase()
        .replace(/[^\w\- ]/g, '')
        .replace(/ /g, '-');

/** Both `# ATX` headings and the underlined kind the README mostly uses. */
const readmeAnchors = () => {
    const lines = readFileSync(
        new URL('../README.md', import.meta.url),
        'utf8'
    ).split('\n');
    const anchors = new Set<string>();

    lines.forEach((line, index) => {
        const atx = /^#{1,6}\s+(.*)$/.exec(line);

        if (atx) {
            anchors.add(slug(atx[1]));

            return;
        }

        const next = lines[index + 1] || '';

        if (line.trim() && /^(=+|-+)$/.test(next.trim())) {
            anchors.add(slug(line));
        }
    });

    return anchors;
};

describe('DOCS', () => {
    /**
     * The setup screen links people straight at the section they are stuck
     * on. Renaming a README heading would quietly turn those into links to
     * the top of the page, so the anchors are checked against the file.
     */
    it('points at headings that exist in README.md', () => {
        const anchors = readmeAnchors();

        for (const [name, url] of Object.entries(DOCS)) {
            const fragment = url.split('#')[1];

            expect(
                anchors.has(fragment),
                `DOCS.${name} points at "#${fragment}", which is not a heading in README.md`
            ).toBe(true);
        }
    });

    it('keeps every link on the project page', () => {
        for (const url of Object.values(DOCS)) {
            expect(url.startsWith(`${PROJECT_URL}#`)).toBe(true);
        }
    });
});
