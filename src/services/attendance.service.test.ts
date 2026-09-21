import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceService } from './attendance.service';
import { ConfigService } from './config.service';
import { diOverride } from '../di';
import { storage } from './local-storage.service';

const FORM_ID = '1FAIpQLSd_eMMMZA855i-zde-euiLG4xcLVfH86HGQsqjeKwA2rhoa8Q';
const CONFIG = { formId: FORM_ID, nameEntry: '1591734977' };

describe('AttendanceService', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    const setUp = (configured = true) => {
        const config = new ConfigService();

        if (configured) {
            config.set(CONFIG);
        }

        diOverride(ConfigService, config);

        return new AttendanceService();
    };

    beforeEach(() => {
        storage.clear();
        fetchMock = vi.fn().mockResolvedValue({ type: 'opaque' });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('posts the name to the configured form', async () => {
        expect(await setUp().submit('Ada')).toBe('sent');

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(
            `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`
        );
        expect(init.method).toBe('POST');
        expect(init.mode).toBe('no-cors');
        expect((init.body as URLSearchParams).get('entry.1591734977')).toBe(
            'Ada'
        );
    });

    it('reports failure when the request cannot leave the device', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));

        expect(await setUp().submit('Ada')).toBe('failed');
    });

    it('queues nothing; a failed entry is simply not recorded', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        await setUp().submit('Ada');

        expect(storage.getItem('pendingEntries')).toBeNull();
    });

    it('posts nothing until the app has been configured', async () => {
        expect(await setUp(false).submit('Ada')).toBe('failed');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('picks up settings changed after it was built', async () => {
        const config = new ConfigService();
        diOverride(ConfigService, config);
        const attendance = new AttendanceService();

        expect(await attendance.submit('Ada')).toBe('failed');

        config.set(CONFIG);

        expect(await attendance.submit('Ada')).toBe('sent');
    });
});
