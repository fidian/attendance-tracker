import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ConfigService,
    deserializeConfig,
    parseFormUrl,
    serializeConfig,
} from './config.service';
import { storage } from './local-storage.service';

const FORM_ID = '1FAIpQLSd_eMMMZA855i-zde-euiLG4xcLVfH86HGQsqjeKwA2rhoa8Q';
const PREFILLED = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform?usp=pp_url&entry.1591734977=Ada`;
const VIEWFORM = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;
const CONFIG = { formId: FORM_ID, nameEntry: '1591734977' };

describe('parseFormUrl', () => {
    it('takes both halves out of a pre-filled link', () => {
        expect(parseFormUrl(PREFILLED)).toEqual(CONFIG);
    });

    it('takes the form id out of a plain viewform link', () => {
        expect(parseFormUrl(VIEWFORM)).toEqual({ formId: FORM_ID });
    });

    it('accepts a bare form id', () => {
        expect(parseFormUrl(`  ${FORM_ID}  `)).toEqual({ formId: FORM_ID });
    });

    it('accepts a bare entry id', () => {
        expect(parseFormUrl('entry.1591734977')).toEqual({
            nameEntry: '1591734977',
        });
    });

    it('finds nothing in unrelated text', () => {
        expect(parseFormUrl('https://example.com/')).toEqual({});
        expect(parseFormUrl('')).toEqual({});
    });
});

describe('serializeConfig / deserializeConfig', () => {
    it('round trips', () => {
        expect(deserializeConfig(`#${serializeConfig(CONFIG)}`)).toEqual(
            CONFIG
        );
    });

    it('reads the fragment with or without the hash', () => {
        expect(deserializeConfig(serializeConfig(CONFIG))).toEqual(CONFIG);
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
        expect(deserializeConfig('#config=short~1')).toBeNull();
    });
});

describe('ConfigService', () => {
    beforeEach(() => {
        storage.clear();
    });

    it('starts unconfigured', () => {
        const config = new ConfigService();

        expect(config.isConfigured()).toBe(false);
        expect(config.get()).toBeNull();
        expect(config.formResponseUrl()).toBeNull();
        expect(config.nameField()).toBeNull();
        expect(config.shareUrl('https://example.com/')).toBeNull();
    });

    it('keeps settings and builds the post URL', () => {
        const config = new ConfigService();

        expect(config.set(CONFIG)).toBe(true);
        expect(config.isConfigured()).toBe(true);
        expect(config.formResponseUrl()).toBe(
            `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`
        );
        expect(config.nameField()).toBe('entry.1591734977');
    });

    it('refuses settings that are not a form id and an entry number', () => {
        const config = new ConfigService();

        expect(config.set({ formId: 'nope', nameEntry: '123' })).toBe(false);
        expect(config.set({ formId: FORM_ID, nameEntry: 'abc' })).toBe(false);
        expect(config.isConfigured()).toBe(false);
    });

    it('persists across instances', () => {
        new ConfigService().set(CONFIG);

        expect(new ConfigService().get()).toEqual(CONFIG);
    });

    it('ignores a stored value that is not settings', () => {
        storage.setItem('formConfig', JSON.stringify([1, { formId: 'nope' }]));

        expect(new ConfigService().isConfigured()).toBe(false);
    });

    it('forgets everything on clear', () => {
        const config = new ConfigService();
        config.set(CONFIG);
        config.clear();

        expect(config.isConfigured()).toBe(false);
        expect(new ConfigService().isConfigured()).toBe(false);
    });

    it('builds a share URL carrying the settings, dropping any old fragment', () => {
        const config = new ConfigService();
        config.set(CONFIG);

        expect(
            config.shareUrl('https://fidian.github.io/attendance-tracker/#old')
        ).toBe(
            `https://fidian.github.io/attendance-tracker/#config=${FORM_ID}~1591734977`
        );
    });

    it('adopts settings handed over in a fragment', () => {
        const config = new ConfigService();

        expect(config.adoptFromHash(`#${serializeConfig(CONFIG)}`)).toBe(true);
        expect(config.get()).toEqual(CONFIG);
    });

    it('leaves settings alone when the fragment carries none', () => {
        const config = new ConfigService();
        config.set(CONFIG);

        expect(config.adoptFromHash('#nothing-here')).toBe(false);
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
