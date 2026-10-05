import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceService } from './attendance.service';
import { ConfigService } from './config.service';
import type { FormField } from './config.service';
import { diOverride } from '../di';
import { storage } from './local-storage.service';

const FORM_ID = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const FIELDS = [
    { id: '111', label: 'First' },
    { id: '222', label: 'Last' },
    { id: '333', label: 'Troop' },
];
const CLAUDE = {
    label: 'Claude (123)',
    values: { First: 'Claude', Last: 'Personname', Troop: '123' },
};

describe('AttendanceService', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    const setUp = (fields: FormField[] | null = FIELDS) => {
        const config = new ConfigService();

        if (fields) {
            config.set({ formId: FORM_ID, fields });
        }

        diOverride(ConfigService, config);

        return new AttendanceService();
    };

    const sent = () =>
        Object.fromEntries(fetchMock.mock.calls[0][1].body as URLSearchParams);

    beforeEach(() => {
        storage.clear();
        fetchMock = vi.fn().mockResolvedValue({ type: 'opaque' });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('posts every question, keyed by its entry id', async () => {
        expect(await setUp().submit(CLAUDE)).toBe('sent');

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(
            `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`
        );
        expect(init.method).toBe('POST');
        expect(init.mode).toBe('no-cors');
        expect(sent()).toEqual({
            'entry.111': 'Claude',
            'entry.222': 'Personname',
            'entry.333': '123',
        });
    });

    it('never posts the display label, only the field values', async () => {
        await setUp().submit(CLAUDE);

        expect(Object.values(sent())).not.toContain('Claude (123)');
    });

    it('sends a question the person has no value for as empty', async () => {
        await setUp().submit({ label: 'Ada', values: { First: 'Ada' } });

        expect(sent()).toEqual({
            'entry.111': 'Ada',
            'entry.222': '',
            'entry.333': '',
        });
    });

    it('reports failure when the request cannot leave the device', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));

        expect(await setUp().submit(CLAUDE)).toBe('failed');
    });

    it('queues nothing; a failed entry is simply not recorded', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        await setUp().submit(CLAUDE);

        expect(storage.getItem('pendingEntries')).toBeNull();
    });

    it('posts nothing until the app has been configured', async () => {
        expect(await setUp(null).submit(CLAUDE)).toBe('failed');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('picks up settings changed after it was built', async () => {
        const config = new ConfigService();
        diOverride(ConfigService, config);
        const attendance = new AttendanceService();

        expect(await attendance.submit(CLAUDE)).toBe('failed');

        config.set({ formId: FORM_ID, fields: FIELDS });

        expect(await attendance.submit(CLAUDE)).toBe('sent');
    });
});
