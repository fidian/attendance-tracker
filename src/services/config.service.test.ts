import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ConfigService,
    deserializeConfig,
    parseFormUrl,
    serializeConfig,
} from './config.service';
import { storage } from './local-storage.service';

const FORM_ID = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const BASE = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;
const FIELDS = [
    { id: '111', label: 'First' },
    { id: '222', label: 'Last' },
    { id: '333', label: 'Troop' },
];
const CONFIG = { formId: FORM_ID, fields: FIELDS };

describe('parseFormUrl', () => {
    it('reads every question out of a pre-filled link, in order', () => {
        const url = `${BASE}?usp=pp_url&entry.111=First&entry.222=Last&entry.333=Troop`;

        expect(parseFormUrl(url)).toEqual({ formId: FORM_ID, fields: FIELDS });
    });

    it('uses the typed value as the question name', () => {
        const url = `${BASE}?usp=pp_url&entry.111=Scout+Name`;

        expect(parseFormUrl(url).fields).toEqual([
            { id: '111', label: 'Scout Name' },
        ]);
    });

    it('skips a box that was left empty, because it carries no name', () => {
        const url = `${BASE}?usp=pp_url&entry.111=First&entry.222=`;

        expect(parseFormUrl(url).fields).toEqual([
            { id: '111', label: 'First' },
        ]);
    });

    it('takes the form id from a plain viewform link but finds no questions', () => {
        expect(parseFormUrl(BASE)).toEqual({ formId: FORM_ID, fields: [] });
    });

    it('accepts a bare form id', () => {
        expect(parseFormUrl(`  ${FORM_ID}  `)).toEqual({
            formId: FORM_ID,
            fields: [],
        });
    });

    it('finds nothing in unrelated text', () => {
        expect(parseFormUrl('https://example.com/?entry.1=x').formId).toBe(
            undefined
        );
        expect(parseFormUrl('')).toEqual({ fields: [] });
    });
});

describe('serializeConfig / deserializeConfig', () => {
    it('round trips every question', () => {
        expect(deserializeConfig(`#${serializeConfig(CONFIG)}`)).toEqual(
            CONFIG
        );
    });

    it('round trips a label with spaces and punctuation', () => {
        const config = {
            formId: FORM_ID,
            fields: [{ id: '111', label: 'Scout name (first & last)' }],
        };

        expect(deserializeConfig(`#${serializeConfig(config)}`)).toEqual(
            config
        );
    });

    it('carries the roster sheet along', () => {
        const config = {
            ...CONFIG,
            csvUrl: 'https://docs.google.com/spreadsheets/d/e/x/pub?output=csv',
        };

        expect(deserializeConfig(`#${serializeConfig(config)}`)).toEqual(
            config
        );
    });

    it('reads it out of a whole shared URL', () => {
        expect(
            deserializeConfig(
                `https://fidian.github.io/attendance-tracker/#${serializeConfig(CONFIG)}`
            )
        ).toEqual(CONFIG);
    });

    it('rejects a fragment that is not settings', () => {
        expect(deserializeConfig('#something-else')).toBeNull();
        expect(deserializeConfig('')).toBeNull();
        expect(deserializeConfig('#config=short~1:x')).toBeNull();
    });

    it('rejects settings carrying no questions', () => {
        expect(deserializeConfig(`#config=${FORM_ID}`)).toBeNull();
    });
});

describe('ConfigService', () => {
    beforeEach(() => {
        storage.clear();
    });

    it('starts unconfigured', () => {
        const config = new ConfigService();

        expect(config.isConfigured()).toBe(false);
        expect(config.fields()).toEqual([]);
        expect(config.formResponseUrl()).toBeNull();
    });

    it('keeps settings and builds the post URL', () => {
        const config = new ConfigService();

        expect(config.set(CONFIG)).toBe(true);
        expect(config.formResponseUrl()).toBe(
            `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`
        );
        expect(config.fieldLabels()).toEqual(['First', 'Last', 'Troop']);
    });

    it('refuses settings with no questions', () => {
        expect(new ConfigService().set({ formId: FORM_ID, fields: [] })).toBe(
            false
        );
    });

    it('refuses a question with a non-numeric id or a blank name', () => {
        const config = new ConfigService();

        expect(
            config.set({ formId: FORM_ID, fields: [{ id: 'a', label: 'x' }] })
        ).toBe(false);
        expect(
            config.set({ formId: FORM_ID, fields: [{ id: '1', label: ' ' }] })
        ).toBe(false);
    });

    it('persists across instances', () => {
        new ConfigService().set(CONFIG);

        expect(new ConfigService().get()).toEqual(CONFIG);
    });

    it('ignores a stored value written to the old single-field shape', () => {
        storage.setItem(
            'formConfig',
            JSON.stringify([1, { formId: FORM_ID, nameEntry: '111' }])
        );

        expect(new ConfigService().isConfigured()).toBe(false);
    });

    it('keeps the roster sheet separately', () => {
        const config = new ConfigService();
        config.set(CONFIG);
        config.setCsvUrl('  https://example.com/pub?output=csv  ');

        expect(config.csvUrl()).toBe('https://example.com/pub?output=csv');
        expect(new ConfigService().csvUrl()).toBe(
            'https://example.com/pub?output=csv'
        );
    });

    it('forgets everything on clear', () => {
        const config = new ConfigService();
        config.set(CONFIG);
        config.clear();

        expect(config.isConfigured()).toBe(false);
        expect(new ConfigService().isConfigured()).toBe(false);
    });

    it('builds a share URL, dropping any old fragment', () => {
        const config = new ConfigService();
        config.set(CONFIG);
        const url = config.shareUrl(
            'https://fidian.github.io/attendance-tracker/#old'
        );

        expect(url?.startsWith('https://fidian.github.io/attendance-tracker/#'))
            .toBe(true);
        expect(deserializeConfig(url || '')).toEqual(CONFIG);
    });

    it('adopts settings handed over in a fragment', () => {
        const config = new ConfigService();

        expect(config.adoptFromHash(`#${serializeConfig(CONFIG)}`)).toBe(true);
        expect(config.get()).toEqual(CONFIG);
    });

    it('notifies subscribers when settings change or are cleared', () => {
        const config = new ConfigService();
        const listener = vi.fn();
        config.subscribe(listener);

        config.set(CONFIG);
        expect(listener).toHaveBeenLastCalledWith(CONFIG);

        config.clear();
        expect(listener).toHaveBeenLastCalledWith(null);
    });
});
