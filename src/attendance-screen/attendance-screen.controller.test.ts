import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROSTER_LIMIT, STORAGE_KEYS } from '../config';
import { diOverride } from '../di';
import {
    AttendanceScreenComponent,
    MIN_HIGHLIGHT_MS,
} from './attendance-screen.controller';
import { AttendanceService } from '../services/attendance.service';
import { ConfigService } from '../services/config.service';
import { CsvService } from '../services/csv.service';
import { OnlineService } from '../services/online.service';
import { RosterService } from '../services/roster.service';
import type { Person } from '../services/roster.service';
import { storage } from '../services/local-storage.service';

const FORM_ID = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const FIELDS = [
    { id: '111', label: 'First' },
    { id: '222', label: 'Troop' },
];

const person = (label: string, values: Record<string, string> = {}): Person => ({
    label,
    values,
});

const ROSTER = [
    person('Ada Byron', { First: 'Ada', Troop: '123' }),
    person('Claude (123)', { First: 'Claude', Troop: '123' }),
    person('Claude (456)', { First: 'Claude', Troop: '456' }),
    person('Zoe Zimmer', { First: 'Zoe', Troop: '456' }),
];

let fetchMock: ReturnType<typeof vi.fn>;

/**
 * Everything but the network is the real thing, so these tests cover the path
 * from a tap to a form post.
 */
const setUp = ({ online = true, roster = ROSTER, csvUrl = '' } = {}) => {
    const config = new ConfigService();
    config.set({ formId: FORM_ID, fields: FIELDS, csvUrl: csvUrl || undefined });
    const rosterService = new RosterService();
    rosterService.replaceAll(roster);
    const onlineService = new OnlineService();
    vi.spyOn(onlineService, 'isOnline').mockReturnValue(online);
    diOverride(ConfigService, config);
    diOverride(RosterService, rosterService);
    diOverride(OnlineService, onlineService);
    diOverride(AttendanceService, new AttendanceService());
    diOverride(CsvService, new CsvService());

    const component = new AttendanceScreenComponent();
    component.onInit();

    return { component, rosterService };
};

/** Lets the minimum-highlight timer elapse and the post settle. */
const settle = (pending: Promise<void>) =>
    vi.advanceTimersByTimeAsync(MIN_HIGHLIGHT_MS).then(() => pending);

const posted = () =>
    fetchMock.mock.calls.map(([, init]) =>
        Object.fromEntries(init.body as URLSearchParams)
    );

const shownLabels = (component: AttendanceScreenComponent) =>
    component.shown.map(p => p.label);

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

    it('shows everyone alphabetically with nothing lit', () => {
        const { component } = setUp();

        expect(shownLabels(component)).toEqual([
            'Ada Byron',
            'Claude (123)',
            'Claude (456)',
            'Zoe Zimmer',
        ]);
        expect(component.marking).toEqual({});
    });

    it('hands the form questions to the add form', () => {
        expect(setUp().component.fields).toEqual(FIELDS);
    });

    it('posts that person on the tap itself, with all their fields', async () => {
        const { component } = setUp();
        await settle(component.mark('Claude (456)'));

        expect(posted()).toEqual([
            { 'entry.111': 'Claude', 'entry.222': '456' },
        ]);
    });

    it('leaves the order alone when someone is marked', async () => {
        const { component } = setUp();
        await settle(component.mark('Zoe Zimmer'));

        expect(shownLabels(component)[0]).toBe('Ada Byron');
    });

    it('lights the tile while the entry is in flight and releases it after', async () => {
        const { component } = setUp();
        const pending = component.mark('Ada Byron');

        expect(component.isMarking('Ada Byron', component.marking)).toBe(true);

        await settle(pending);

        expect(component.isMarking('Ada Byron', component.marking)).toBe(false);
    });

    it('keeps the tile lit until a slow post lands, not just the timer', async () => {
        let release = () => {};
        fetchMock.mockReturnValue(
            new Promise(resolve => {
                release = () => resolve({ type: 'opaque' });
            })
        );
        const { component } = setUp();
        const pending = component.mark('Ada Byron');

        await vi.advanceTimersByTimeAsync(MIN_HIGHLIGHT_MS * 10);
        expect(component.isMarking('Ada Byron', component.marking)).toBe(true);

        release();
        await pending;
        expect(component.isMarking('Ada Byron', component.marking)).toBe(false);
    });

    it('ignores a second tap on someone already in flight', async () => {
        const { component } = setUp();
        const first = component.mark('Ada Byron');
        await component.mark('Ada Byron');
        await settle(first);

        expect(posted()).toHaveLength(1);
    });

    it('ignores a tap on somebody who is not on the roster', async () => {
        const { component } = setUp();
        await settle(component.mark('Nobody'));

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('says so when the entry could not be sent', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        const { component } = setUp();
        await settle(component.mark('Ada Byron'));

        expect(component.toast).toContain('was not sent');
    });

    describe('filtering', () => {
        it('narrows on the start of any word in the label', () => {
            const { component } = setUp();
            component.setFilter('zim');

            expect(shownLabels(component)).toEqual(['Zoe Zimmer']);
        });

        it('ignores case and stray spaces', () => {
            const { component } = setUp();
            component.setFilter('  ADA  ');

            expect(shownLabels(component)).toEqual(['Ada Byron']);
        });

        it('matches a field value, so a troop number finds its people', () => {
            const { component } = setUp();
            component.setFilter('456');

            expect(shownLabels(component)).toEqual([
                'Claude (456)',
                'Zoe Zimmer',
            ]);
        });

        it('keeps both people who share a first name', () => {
            const { component } = setUp();
            component.setFilter('claude');

            expect(shownLabels(component)).toEqual([
                'Claude (123)',
                'Claude (456)',
            ]);
        });

        it('shows nobody when nothing matches, and everyone when cleared', () => {
            const { component } = setUp();
            component.setFilter('qqq');
            expect(component.shown).toEqual([]);

            component.clearFilter();
            expect(component.shown).toHaveLength(4);
        });

        it('still marks the right person while a filter is on', async () => {
            const { component } = setUp();
            component.setFilter('456');
            await settle(component.mark('Claude (456)'));

            expect(posted()).toEqual([
                { 'entry.111': 'Claude', 'entry.222': '456' },
            ]);
        });
    });

    describe('editing', () => {
        it('refuses to mark anyone while the roster is being edited', async () => {
            const { component } = setUp();
            component.toggleEditing();
            await settle(component.mark('Ada Byron'));

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('reports every tile as unavailable while editing', () => {
            const { component } = setUp();
            component.toggleEditing();

            expect(
                component.isBusy(
                    'Ada Byron',
                    component.marking,
                    component.online,
                    component.editing
                )
            ).toBe(true);
        });

        it('removes someone without posting anything', () => {
            const { component } = setUp();
            component.remove('Ada Byron');

            expect(shownLabels(component)).not.toContain('Ada Byron');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('takes entries again once editing is turned off', async () => {
            const { component } = setUp();
            component.toggleEditing();
            component.toggleEditing();
            await settle(component.mark('Ada Byron'));

            expect(posted()).toHaveLength(1);
        });
    });

    describe('adding by hand', () => {
        it('adds the person and marks them in one go', async () => {
            const { component } = setUp();
            component.startAdding();
            await settle(
                component.addPerson(
                    person('Mabel (789)', { First: 'Mabel', Troop: '789' })
                )
            );

            expect(shownLabels(component)).toContain('Mabel (789)');
            expect(posted()).toEqual([
                { 'entry.111': 'Mabel', 'entry.222': '789' },
            ]);
            expect(component.adding).toBe(false);
        });

        it('clears the filter so the new person is visible', async () => {
            const { component } = setUp();
            component.setFilter('zzz');
            await settle(component.addPerson(person('Mabel')));

            expect(component.filter).toBe('');
            expect(shownLabels(component)).toContain('Mabel');
        });

        it('works with no CSV anywhere, from an empty roster', async () => {
            const { component } = setUp({ roster: [] });
            await settle(
                component.addPerson(
                    person('Solo', { First: 'Solo', Troop: '1' })
                )
            );

            expect(shownLabels(component)).toEqual(['Solo']);
            expect(posted()).toEqual([
                { 'entry.111': 'Solo', 'entry.222': '1' },
            ]);
        });

        it('refuses to open the add form when the roster is full', () => {
            const { component } = setUp({
                roster: Array.from({ length: ROSTER_LIMIT }, (_v, i) =>
                    person(`Scout ${i}`)
                ),
            });
            component.startAdding();

            expect(component.adding).toBe(false);
            expect(component.toast).toContain(`${ROSTER_LIMIT} people`);
        });
    });

    describe('offline', () => {
        it('refuses to mark anyone', async () => {
            const { component } = setUp({ online: false });
            await settle(component.mark('Ada Byron'));

            expect(fetchMock).not.toHaveBeenCalled();
            expect(component.marking).toEqual({});
        });

        it('reports every tile as unavailable', () => {
            const { component } = setUp({ online: false });

            expect(
                component.isBusy(
                    'Ada Byron',
                    component.marking,
                    component.online,
                    component.editing
                )
            ).toBe(true);
        });
    });

    /**
     * There is no offline mode. If a future change starts holding entries on
     * the device, this fails -- attendance belongs on the sheet or nowhere.
     */
    it('never writes an attendance entry to storage, sent or not', async () => {
        const setItem = vi.spyOn(storage, 'setItem');
        const { component } = setUp();
        await settle(component.addPerson(person('Ada2', { First: 'Ada' })));

        fetchMock.mockRejectedValue(new Error('offline'));
        await settle(component.mark('Ada Byron'));

        const keys = [...new Set(setItem.mock.calls.map(([key]) => key))];

        // The roster was written, so the spy is definitely working.
        expect(keys).toContain('roster');
        expect(keys.filter(key => !STORAGE_KEYS.includes(key))).toEqual([]);
    });

    describe('a device just set up by a shared code', () => {
        const SHEET =
            'Displayed,First,Troop\nAda Byron,Ada,123\nZoe Zimmer,Zoe,456';

        it('fills an empty roster from the sheet the code carried', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                status: 200,
                text: () => Promise.resolve(SHEET),
            });
            const { component } = setUp({
                roster: [],
                csvUrl: 'https://example.com/pub',
            });

            await vi.waitFor(() => expect(component.shown).toHaveLength(2));
            expect(shownLabels(component)).toEqual([
                'Ada Byron',
                'Zoe Zimmer',
            ]);
        });

        it('leaves a roster that already has people alone', async () => {
            const { component } = setUp({ csvUrl: 'https://example.com/pub' });
            await vi.advanceTimersByTimeAsync(10);

            expect(fetchMock).not.toHaveBeenCalled();
            expect(component.shown).toHaveLength(4);
        });

        it('does not reach for the sheet while offline', async () => {
            setUp({
                roster: [],
                online: false,
                csvUrl: 'https://example.com/pub',
            });
            await vi.advanceTimersByTimeAsync(10);

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('says so when the sheet cannot be read', async () => {
            fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
            const { component } = setUp({
                roster: [],
                csvUrl: 'https://example.com/pub',
            });

            await vi.waitFor(() =>
                expect(component.toast).toContain('Could not load')
            );
        });
    });

    it('stops listening once it is destroyed', () => {
        const { component, rosterService } = setUp();
        component.onDestroy();
        rosterService.add(person('Later'));

        expect(shownLabels(component)).not.toContain('Later');
    });
});
