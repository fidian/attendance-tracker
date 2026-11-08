/**
 * Split from the `component()` call so the behavior is testable under Node.
 * See AGENTS.md.
 */
import { emit } from 'fudgel';
import { di } from '../di';
import { DOCS } from '../config';
import { plural } from '../services/text';
import {
    defaultEventName,
    EventService,
    type AttendanceEvent,
} from '../services/event.service';
import { forCopy, RosterService } from '../services/roster.service';
import { SEED_COLUMNS, SEED_PEOPLE } from '../services/seed';
import { BackupService } from '../services/backup.service';
import { SheetService } from '../services/sheet.service';
import type { MenuItem } from '../app-menu/app-menu.component';
import { NavigationService } from '../services/navigation.service';

export type ListView = 'list' | 'new';

const TOAST_MS = 4000;

export class EventListScreenComponent {
    private _backupService = di(BackupService);
    private _eventService = di(EventService);
    private _sheetService = di(SheetService);
    private _navigationService = di(NavigationService);
    private _rosterService = di(RosterService);
    private _toastTimer?: ReturnType<typeof setTimeout>;
    private _unwatch?: () => void;

    busy = false;
    error = '';
    picker?: HTMLInputElement;
    events: AttendanceEvent[] = [];
    /** Null until the first read lands, so "empty" is not shown too early. */
    loaded = false;
    newName = '';
    /** '' means start empty; otherwise the event to copy the roster from. */
    newSource = '';
    toast = '';
    view: ListView = 'list';

    onInit() {
        this._unwatch = this._eventService.watch(events => {
            this.events = events;
            this.loaded = true;
        });
    }

    onDestroy() {
        clearTimeout(this._toastTimer);
        this._unwatch?.();
    }

    menuItems(events: AttendanceEvent[]): MenuItem[] {
        return [
            { id: 'new', label: 'New event' },
            {
                id: 'copy',
                label: 'Copy an event',
                disabled: !events.length,
            },
            {
                id: 'backup',
                label: 'Back up everything',
                disabled: !events.length,
            },
            { id: 'restore', label: 'Restore from a backup' },
            { id: 'settings', label: 'Settings' },
            { id: 'help', label: 'Help' },
        ];
    }

    onMenu(id: string) {
        if (id === 'new' || id === 'copy') {
            this.startNew(id === 'copy');
        } else if (id === 'backup') {
            this.backup();
        } else if (id === 'restore') {
            this.picker?.click();
        } else if (id === 'settings') {
            emit(this, 'setupOpen');
        } else if (id === 'help') {
            open(DOCS.firebase, '_blank', 'noopener,noreferrer');
        }
    }

    /** One dialog for both: copying is just a different starting roster. */
    startNew(copy = false) {
        this.newName = defaultEventName(new Date(), 'Meeting');
        this.newSource = copy ? this.events[0]?.id || '' : '';
        this.error = '';
        this.view = 'new';
    }

    cancelNew() {
        this.view = 'list';
        this.error = '';
    }

    setNewName(text: string) {
        this.newName = text;
    }

    setNewSource(id: string) {
        this.newSource = id;
    }

    async createEvent() {
        const name = this.newName.trim();

        if (!name || this.busy) {
            return;
        }

        this.busy = true;
        this.error = '';

        try {
            const id = await this._eventService.create(
                name,
                await this._columnsFor(this.newSource)
            );

            if (this.newSource) {
                const people = await this._rosterService.list(this.newSource);
                await this._rosterService.replaceAll(id, forCopy(people));
            }

            this.view = 'list';
            this.open(id);
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    /** A copied event keeps the column order its roster was imported with. */
    private async _columnsFor(sourceId: string): Promise<string[]> {
        if (!sourceId) {
            return [];
        }

        const source = await this._eventService.find(sourceId);

        return source?.columns || [];
    }

    /**
     * Offered only when the database has nothing in it at all, so it cannot
     * appear on a group that somebody has merely emptied for the evening.
     */
    canSeed(loaded: boolean, events: AttendanceEvent[], busy: boolean) {
        return loaded && !events.length && !busy;
    }

    async seed() {
        if (this.busy) {
            return;
        }

        this.busy = true;
        this.error = '';

        try {
            const id = await this._eventService.create(
                defaultEventName(new Date(), 'Sample Event'),
                SEED_COLUMNS
            );
            await this._rosterService.replaceAll(
                id,
                SEED_PEOPLE.map(person => ({ ...person, present: false }))
            );
            this._showToast(
                `Added ${plural(SEED_PEOPLE.length, 'sample person', 'sample people')}.`
            );
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    open(id: string) {
        this._navigationService.go('event', id);
    }

    async backup() {
        if (this.busy) {
            return;
        }

        this.busy = true;
        this.error = '';

        try {
            const backup = await this._backupService.create();
            this._sheetService.downloadJson(
                `attendance backup ${backup.exportedAt.slice(0, 10)}`,
                backup
            );
            this._showToast(
                `Saved ${plural(Object.keys(backup.events).length, 'event')}.`
            );
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    onFilePicked(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        // Cleared so picking the same file twice still fires a change.
        input.value = '';

        if (file) {
            this.restore(file);
        }
    }

    /** Replaces everything in this group, so it asks first. */
    async restore(file: File) {
        if (this.busy) {
            return;
        }

        if (
            !confirm(
                'Restoring replaces every event and roster in this group. Continue?'
            )
        ) {
            return;
        }

        this.busy = true;
        this.error = '';

        try {
            const count = await this._backupService.restore(
                JSON.parse(await file.text())
            );
            this._showToast(`Restored ${plural(count, 'event')}.`);
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    private _message(error: unknown) {
        const text = (error as Error)?.message || 'Something went wrong.';

        return /permission|denied/i.test(text)
            ? 'The database refused that. Check the security rules were published.'
            : text;
    }

    private _showToast(message: string) {
        clearTimeout(this._toastTimer);
        this.toast = message;
        this._toastTimer = setTimeout(() => {
            this.toast = '';
        }, TOAST_MS);
    }
}
