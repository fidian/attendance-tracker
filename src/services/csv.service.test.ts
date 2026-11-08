import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.service';

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
