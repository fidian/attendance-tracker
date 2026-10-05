import { describe, expect, it, vi } from 'vitest';
import { CsvService, parseCsv } from './csv.service';

const LABELS = ['First', 'Last', 'Troop'];

const SHEET = [
    'Displayed,First,Last,Troop',
    'Claude (123),Claude,Personname,123',
    'Claude (456),Claude,Johnson,456',
].join('\n');

describe('parseCsv', () => {
    it('reads a plain sheet', () => {
        expect(parseCsv('a,b\n1,2\n')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });

    it('keeps commas inside quotes', () => {
        expect(parseCsv('a,b\n"Doe, Jane",2')).toEqual([
            ['a', 'b'],
            ['Doe, Jane', '2'],
        ]);
    });

    it('unescapes doubled quotes', () => {
        expect(parseCsv('a\n"She said ""hi"""')).toEqual([
            ['a'],
            ['She said "hi"'],
        ]);
    });

    it('keeps newlines inside quotes', () => {
        expect(parseCsv('a,b\n"one\ntwo",2')).toEqual([
            ['a', 'b'],
            ['one\ntwo', '2'],
        ]);
    });

    it('handles CRLF and a missing final newline', () => {
        expect(parseCsv('a,b\r\n1,2')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });

    it('drops blank lines and a byte-order mark', () => {
        expect(parseCsv('﻿a,b\n\n1,2\n\n')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });
});

describe('CsvService', () => {
    const csv = new CsvService();

    it('takes the first column as the label and matches the rest by heading', () => {
        const result = csv.toPeople(parseCsv(SHEET), LABELS);

        expect(result.people).toEqual([
            {
                label: 'Claude (123)',
                values: { First: 'Claude', Last: 'Personname', Troop: '123' },
            },
            {
                label: 'Claude (456)',
                values: { First: 'Claude', Last: 'Johnson', Troop: '456' },
            },
        ]);
        expect(result.missingFields).toEqual([]);
        expect(result.unmatchedColumns).toEqual([]);
    });

    it('matches headings regardless of case and padding', () => {
        const result = csv.toPeople(
            parseCsv('Displayed, first ,LAST,Troop\nA,x,y,z'),
            LABELS
        );

        expect(result.people[0].values).toEqual({
            First: 'x',
            Last: 'y',
            Troop: 'z',
        });
    });

    it('reports a heading that matches no question', () => {
        const result = csv.toPeople(
            parseCsv('Displayed,First,Nickname\nA,x,y'),
            LABELS
        );

        expect(result.unmatchedColumns).toEqual(['Nickname']);
        expect(result.people[0].values).toEqual({ First: 'x' });
    });

    it('reports a question with no column, because Google may require it', () => {
        const result = csv.toPeople(parseCsv('Displayed,First\nA,x'), LABELS);

        expect(result.missingFields).toEqual(['Last', 'Troop']);
    });

    it('skips rows with no label', () => {
        const result = csv.toPeople(
            parseCsv('Displayed,First\nA,x\n,y\n  ,z'),
            LABELS
        );

        expect(result.people.map(p => p.label)).toEqual(['A']);
    });

    it('fills values from the labels it is handed, saved or not', () => {
        // The setup screen imports before Save is pressed, so the questions
        // come from the screen rather than from stored settings.
        const result = csv.toPeople(parseCsv(SHEET), LABELS);

        expect(result.people[0].values).toEqual({
            First: 'Claude',
            Last: 'Personname',
            Troop: '123',
        });
    });

    it('matches nothing when handed no labels', () => {
        const result = csv.toPeople(parseCsv(SHEET), []);

        expect(result.people[0].values).toEqual({});
        expect(result.unmatchedColumns).toEqual(['First', 'Last', 'Troop']);
    });

    it('works with a single-question form and a two-column sheet', () => {
        const result = csv.toPeople(parseCsv('Displayed,Name\nAda,Ada Byron'), [
            'Name',
        ]);

        expect(result.people).toEqual([
            { label: 'Ada', values: { Name: 'Ada Byron' } },
        ]);
    });

    describe('fetchPeople', () => {
        it('reads a published sheet', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve(SHEET),
                })
            );

            const result = await csv.fetchPeople('https://example.com/pub', LABELS);
            expect(result.people).toHaveLength(2);
            vi.unstubAllGlobals();
        });

        /**
         * Google caches a published sheet by URL and can serve an edit
         * minutes late. Importing again has to actually re-read it.
         */
        it('asks for an address nothing has cached yet', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: () => Promise.resolve(SHEET),
            });
            vi.stubGlobal('fetch', fetchMock);

            await csv.fetchPeople('https://example.com/pub?output=csv', LABELS);
            const first = String(fetchMock.mock.calls[0][0]);

            expect(first).toMatch(/[?&]_=\d+/);
            expect(first.startsWith('https://example.com/pub?output=csv&'))
                .toBe(true);

            vi.unstubAllGlobals();
        });

        it('adds the cache-buster to an address with no query of its own', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: () => Promise.resolve(SHEET),
            });
            vi.stubGlobal('fetch', fetchMock);

            await csv.fetchPeople('https://example.com/roster.csv', LABELS);

            expect(String(fetchMock.mock.calls[0][0])).toMatch(
                /^https:\/\/example\.com\/roster\.csv\?_=\d+$/
            );

            vi.unstubAllGlobals();
        });

        it('explains a CORS failure in terms of publishing', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
            );

            await expect(
                csv.fetchPeople('https://example.com/pub', LABELS)
            ).rejects.toThrow(/published to the web/);
            vi.unstubAllGlobals();
        });

        it('reports a bad status', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 404,
                    text: () => Promise.resolve(''),
                })
            );

            await expect(
                csv.fetchPeople('https://example.com/pub', LABELS)
            ).rejects.toThrow(/404/);
            vi.unstubAllGlobals();
        });

        it('notices an HTML page served instead of a CSV', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('<!doctype html><html>'),
                })
            );

            await expect(
                csv.fetchPeople('https://example.com/edit', LABELS)
            ).rejects.toThrow(/not a CSV/);
            vi.unstubAllGlobals();
        });

        it('refuses a sheet with no usable rows', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('Displayed,First\n'),
                })
            );

            await expect(
                csv.fetchPeople('https://example.com/pub', LABELS)
            ).rejects.toThrow(/No rows/);
            vi.unstubAllGlobals();
        });
    });
});
