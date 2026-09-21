import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECENT_NAME_LIMIT, STORAGE_KEYS } from '../config';
import { diOverride } from '../di';
import {
    AttendanceScreenComponent,
    MIN_HIGHLIGHT_MS,
} from './attendance-screen.controller';
import { AttendanceService } from '../services/attendance.service';
import { ConfigService } from '../services/config.service';
import { OnlineService } from '../services/online.service';
import { RosterService } from '../services/roster.service';
import { storage } from '../services/local-storage.service';

const CONFIG = {
    formId: '1FAIpQLSd_eMMMZA855i-zde-euiLG4xcLVfH86HGQsqjeKwA2rhoa8Q',
    nameEntry: '1591734977',
};

let fetchMock: ReturnType<typeof vi.fn>;

/**
 * Everything but the network is the real thing, so these tests cover the path
 * from a tap to a form post.
 */
const setUp = ({ online = true } = {}) => {
    const config = new ConfigService();
    config.set(CONFIG);
    const roster = new RosterService();
    const onlineService = new OnlineService();
    vi.spyOn(onlineService, 'isOnline').mockReturnValue(online);
    diOverride(ConfigService, config);
    diOverride(RosterService, roster);
    diOverride(OnlineService, onlineService);
    diOverride(AttendanceService, new AttendanceService());

    const component = new AttendanceScreenComponent();
    component.onInit();

    return { component, onlineService, roster };
};

/** Lets the minimum-highlight timer elapse and the post settle. */
const settle = (pending: Promise<void>) =>
    vi.advanceTimersByTimeAsync(MIN_HIGHLIGHT_MS).then(() => pending);

const postedNames = () =>
    fetchMock.mock.calls.map(([, init]) =>
        (init.body as URLSearchParams).get('entry.1591734977')
    );

const storeNames = (...names: string[]) =>
    storage.setItem('recentNames', JSON.stringify([1, names]));

describe('AttendanceScreenComponent', () => {
    beforeEach(() => {
        storage.clear();
        vi.useFakeTimers();
        fetchMock = vi.fn().mockResolvedValue({ type: 'opaque' });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('shows the stored names alphabetically with nothing lit', () => {
        storeNames('Zoe', 'Ada');
        const { component } = setUp();

        expect(component.names).toEqual(['Ada', 'Zoe']);
        expect(component.marking).toEqual({});
    });

    it('posts on the tap itself, with no second press', async () => {
        storeNames('Ada', 'Zoe');
        const { component } = setUp();
        await settle(component.mark('Zoe'));

        expect(postedNames()).toEqual(['Zoe']);
    });

    it('leaves the order alone when a name is marked', async () => {
        storeNames('Ada', 'Zoe');
        const { component } = setUp();
        await settle(component.mark('Zoe'));

        expect(component.names).toEqual(['Ada', 'Zoe']);
    });

    it('lights the name while the entry is in flight and releases it after', async () => {
        storeNames('Ada');
        const { component } = setUp();
        const pending = component.mark('Ada');

        expect(component.isMarking('Ada', component.marking)).toBe(true);

        await settle(pending);

        expect(component.isMarking('Ada', component.marking)).toBe(false);
    });

    it('keeps the name lit until a slow post lands, not just the timer', async () => {
        let release = () => {};
        fetchMock.mockReturnValue(
            new Promise(resolve => {
                release = () => resolve({ type: 'opaque' });
            })
        );
        const { component } = setUp();
        const pending = component.mark('Ada');

        await vi.advanceTimersByTimeAsync(MIN_HIGHLIGHT_MS * 10);
        expect(component.isMarking('Ada', component.marking)).toBe(true);

        release();
        await pending;
        expect(component.isMarking('Ada', component.marking)).toBe(false);
    });

    it('holds the highlight briefly even when the post returns at once', async () => {
        const { component } = setUp();
        const pending = component.mark('Ada');

        await vi.advanceTimersByTimeAsync(MIN_HIGHLIGHT_MS - 50);
        expect(component.isMarking('Ada', component.marking)).toBe(true);

        await settle(pending);
        expect(component.isMarking('Ada', component.marking)).toBe(false);
    });

    it('ignores a second tap on a name already in flight', async () => {
        const { component } = setUp();
        const first = component.mark('Ada');
        await component.mark('Ada');
        await settle(first);

        expect(postedNames()).toEqual(['Ada']);
    });

    it('marks two different names at once', async () => {
        storeNames('Ada', 'Grace');
        const { component } = setUp();
        const both = Promise.all([
            component.mark('Ada'),
            component.mark('Grace'),
        ]);

        expect(component.isMarking('Ada', component.marking)).toBe(true);
        expect(component.isMarking('Grace', component.marking)).toBe(true);

        await vi.advanceTimersByTimeAsync(MIN_HIGHLIGHT_MS);
        await both;

        expect(postedNames().sort()).toEqual(['Ada', 'Grace']);
        expect(component.marking).toEqual({});
    });

    it('ignores a blank name', async () => {
        const { component } = setUp();
        await settle(component.mark('   '));

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('says nothing on a successful entry; the fade is the confirmation', async () => {
        const { component } = setUp();
        await settle(component.mark('Ada'));

        expect(component.toast).toBe('');
    });

    it('says so when the entry could not be sent', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        const { component } = setUp();
        await settle(component.mark('Ada'));

        expect(component.toast).toContain('was not sent');
    });

    it('clears the toast after a few seconds', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        const { component } = setUp();
        await settle(component.mark('Ada'));
        expect(component.toast).not.toBe('');

        await vi.advanceTimersByTimeAsync(10000);
        expect(component.toast).toBe('');
    });

    describe('offline', () => {
        it('refuses to mark anyone', async () => {
            const { component } = setUp({ online: false });
            await settle(component.mark('Ada'));

            expect(fetchMock).not.toHaveBeenCalled();
            expect(component.marking).toEqual({});
        });

        it('reports every name as unavailable', () => {
            const { component } = setUp({ online: false });

            expect(component.isBusy('Ada', component.marking, component.online))
                .toBe(true);
        });

        it('takes entries again once the connection returns', async () => {
            const { component, onlineService } = setUp({ online: false });
            onlineService.subscribe(() => {});
            component.online = true;
            await settle(component.mark('Ada'));

            expect(postedNames()).toEqual(['Ada']);
        });
    });

    it('adds a typed name to the list and marks that person in one press', async () => {
        storeNames('Zoe');
        const { component } = setUp();
        await settle(component.addName('  Ada   Byron '));

        expect(component.names).toEqual(['Ada Byron', 'Zoe']);
        expect(postedNames()).toEqual(['Ada Byron']);
    });

    it('marks an already-listed typed name without repeating it', async () => {
        storeNames('Ada Byron', 'Zoe');
        const { component } = setUp();
        await settle(component.addName('ada byron'));

        expect(component.names).toEqual(['Ada Byron', 'Zoe']);
        expect(postedNames()).toEqual(['ada byron']);
    });

    it('refuses a new name when the list is full, and marks nobody', async () => {
        storeNames(
            ...Array.from(
                { length: RECENT_NAME_LIMIT },
                (_value, index) => `Scout ${index + 1}`
            )
        );
        const { component } = setUp();
        await settle(component.addName('Newcomer'));

        expect(component.toast).toContain(`${RECENT_NAME_LIMIT} names`);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(component.names).not.toContain('Newcomer');
    });

    /**
     * There is no offline mode. If a future change starts holding entries on
     * the device, this fails -- attendance belongs on the sheet or nowhere.
     */
    it('never writes an attendance entry to storage, sent or not', async () => {
        const setItem = vi.spyOn(storage, 'setItem');
        const { component } = setUp();
        await settle(component.addName('Ada'));

        fetchMock.mockRejectedValue(new Error('offline'));
        await settle(component.mark('Ada'));

        const keys = [...new Set(setItem.mock.calls.map(([key]) => key))];

        // The name list was written, so the spy is definitely working.
        expect(keys).toContain('recentNames');
        expect(keys.filter(key => !STORAGE_KEYS.includes(key))).toEqual([]);
    });

    it('removes a name without posting anything', () => {
        storeNames('Ada', 'Zoe');
        const { component } = setUp();
        component.remove('Ada');

        expect(component.names).toEqual(['Zoe']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('stops listening once it is destroyed', () => {
        const { component, roster } = setUp();
        component.onDestroy();
        roster.add('Ada');

        expect(component.names).toEqual([]);
    });
});
