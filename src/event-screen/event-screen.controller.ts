/**
 * Split from the `component()` call so the behavior is testable under Node.
 * See AGENTS.md.
 */
import { di } from '../di';
import { plural } from '../services/text';
import { EventService, type AttendanceEvent } from '../services/event.service';
import { NavigationService } from '../services/navigation.service';
import { OnlineService } from '../services/online.service';
import { RosterService, type Person } from '../services/roster.service';
import {
    reportToRows,
    rosterToRows,
    rowsToPeople,
    SheetService,
} from '../services/sheet.service';
import type { MenuItem } from '../app-menu/app-menu.component';

export type EventView = 'list' | 'rename' | 'confirm-delete';

const TOAST_MS = 4000;

export class EventScreenComponent {
    private _eventService = di(EventService);
    private _navigationService = di(NavigationService);
    private _onlineService = di(OnlineService);
    private _rosterService = di(RosterService);
    private _sheetService = di(SheetService);
    private _toastTimer?: ReturnType<typeof setTimeout>;
    private _unsubscribe: (() => void)[] = [];
    private _unwatchRoster?: () => void;

    busy = false;
    error = '';
    event: AttendanceEvent | null = null;
    eventId = '';
    loaded = false;
    online = true;
    picker?: HTMLInputElement;
    people: Person[] = [];
    /** Who has a write in flight, so a slow network is visible. */
    pending: Record<string, true> = {};
    renameTo = '';
    toast = '';
    view: EventView = 'list';

    onInit() {
        this.online = this._onlineService.isOnline();
        this._unsubscribe.push(
            this._onlineService.subscribe(online => {
                this.online = online;
            }),
            // Going from one event straight to another keeps this element
            // alive, so the work of opening an event cannot live in onInit.
            this._navigationService.subscribe(route => {
                if (route.screen === 'event' && route.eventId !== this.eventId) {
                    this._open(route.eventId);
                }
            })
        );
        this._open(this._navigationService.current().eventId);
    }

    onDestroy() {
        clearTimeout(this._toastTimer);
        this._unwatchRoster?.();

        for (const unsubscribe of this._unsubscribe) {
            unsubscribe();
        }
    }

    /** Everything that depends on which event is open. */
    private _open(eventId: string) {
        this._unwatchRoster?.();
        this.eventId = eventId;
        this.event = null;
        this.people = [];
        this.pending = {};
        this.loaded = false;
        this.error = '';
        this.view = 'list';
        this._unwatchRoster = this._rosterService.watch(eventId, people => {
            this.people = people;
            this.loaded = true;
        });
        this._loadEvent();
    }

    private async _loadEvent() {
        try {
            this.event = await this._eventService.find(this.eventId);

            if (!this.event) {
                // Somebody deleted it on another phone while this was open.
                this._navigationService.replace('events');
            }
        } catch (error) {
            this.error = this._message(error);
        }
    }

    title(event: AttendanceEvent | null) {
        return event?.name || 'Event';
    }

    menuItems(): MenuItem[] {
        return [
            { id: 'people', label: 'Manage people' },
            { id: 'import', label: 'Import roster' },
            { id: 'export-csv', label: 'Export roster (CSV)' },
            { id: 'export-xlsx', label: 'Export roster (Excel)' },
            { id: 'report-csv', label: 'Export report (CSV)' },
            { id: 'report-xlsx', label: 'Export report (Excel)' },
            { id: 'rename', label: 'Rename event' },
            { id: 'copy', label: 'Copy event' },
            { id: 'delete', label: 'Delete event', danger: true },
        ];
    }

    /**
     * Every menu id mapped to what it does. Kept as data rather than a chain
     * of branches so a test can assert that nothing in the menu is a dead
     * entry -- `Export roster (Excel)` shipped once with no handler at all.
     */
    menuActions(): Record<string, () => void> {
        return {
            people: () => this._navigationService.go('people', this.eventId),
            import: () => this.picker?.click(),
            'export-csv': () => this.exportRoster(),
            'export-xlsx': () => void this.exportRosterXlsx(),
            'report-csv': () => this.exportReport(),
            'report-xlsx': () => void this.exportReportXlsx(),
            rename: () => {
                this.renameTo = this.event?.name || '';
                this.view = 'rename';
            },
            copy: () => void this.copyEvent(),
            delete: () => {
                this.view = 'confirm-delete';
            },
        };
    }

    onMenu(id: string) {
        this.menuActions()[id]?.();
    }

    back() {
        this._navigationService.go('events');
    }

    onFilePicked(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        // Cleared so picking the same file twice still fires a change.
        input.value = '';

        if (file) {
            this.importFile(file);
        }
    }

    isPresent(person: Person) {
        return person.present;
    }

    isPending(id: string, pending: Record<string, true>) {
        return !!pending[id];
    }

    isBusy(id: string, pending: Record<string, true>, online: boolean) {
        return !online || !!pending[id];
    }

    /**
     * The whole interaction. The write goes out immediately and the database
     * echoes it back to every device including this one, so there is nothing
     * to reconcile -- the listener is the only thing that sets `present`.
     */
    async toggle(person: Person) {
        if (!this.online || this.pending[person.id]) {
            return;
        }

        this.pending = { ...this.pending, [person.id]: true };

        try {
            await this._rosterService.setPresent(
                this.eventId,
                person.id,
                !person.present
            );
        } catch (error) {
            this._showToast(
                `${person.display} was not saved. ${this._message(error)}`
            );
        }

        const pending = { ...this.pending };
        delete pending[person.id];
        this.pending = pending;
    }

    setRenameTo(text: string) {
        this.renameTo = text;
    }

    async rename() {
        const name = this.renameTo.trim();

        if (!name || this.busy) {
            return;
        }

        this.busy = true;

        try {
            await this._eventService.rename(this.eventId, name);
            this.event = this.event ? { ...this.event, name } : null;
            this.view = 'list';
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    async copyEvent() {
        if (this.busy || !this.event) {
            return;
        }

        this.busy = true;

        try {
            const id = await this._eventService.create(
                `${this.event.name} (copy)`,
                this.event.columns
            );
            const { forCopy } = await import('../services/roster.service');
            await this._rosterService.replaceAll(id, forCopy(this.people));
            this._navigationService.go('event', id);
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    async deleteEvent() {
        if (this.busy) {
            return;
        }

        this.busy = true;

        try {
            await this._eventService.remove(this.eventId);
            this._navigationService.replace('events');
        } catch (error) {
            this.error = this._message(error);
            this.view = 'list';
        }

        this.busy = false;
    }

    cancel() {
        this.view = 'list';
        this.error = '';
    }

    exportRoster() {
        this._sheetService.downloadCsv(
            `${this.title(this.event)} roster`,
            rosterToRows(this.people, this.event?.columns || [])
        );
    }

    exportReport() {
        this._sheetService.downloadCsv(
            `${this.title(this.event)} attendance`,
            reportToRows(this.people, this.event?.columns || [])
        );
    }

    exportRosterXlsx() {
        return this._xlsx(
            `${this.title(this.event)} roster`,
            rosterToRows(this.people, this.event?.columns || [])
        );
    }

    exportReportXlsx() {
        return this._xlsx(
            `${this.title(this.event)} attendance`,
            reportToRows(this.people, this.event?.columns || [])
        );
    }

    /**
     * Writing a spreadsheet fetches the library first, so this can fail where
     * the CSV path cannot. A silent nothing would look like a broken menu.
     */
    private async _xlsx(filename: string, rows: string[][]) {
        this.busy = true;

        try {
            await this._sheetService.downloadXlsx(filename, rows);
        } catch (error) {
            this._showToast(`The spreadsheet could not be made. ${this._message(error)}`);
        }

        this.busy = false;
    }

    /** Replaces the roster outright, as an import does. */
    async importFile(file: File) {
        if (this.busy) {
            return;
        }

        this.busy = true;
        this.error = '';

        try {
            const result = rowsToPeople(await this._sheetService.read(file));

            if (!result.people.length) {
                throw new Error('No rows with a name in the first column.');
            }

            await this._eventService.setColumns(this.eventId, result.columns);
            const dropped = await this._rosterService.replaceAll(
                this.eventId,
                result.people
            );
            this.event = this.event
                ? { ...this.event, columns: result.columns }
                : null;
            this._showToast(
                this._importNotice(result.people.length, dropped, result.duplicateColumns)
            );
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    private _importNotice(
        imported: number,
        dropped: number,
        duplicates: string[]
    ) {
        const parts = [`Imported ${plural(imported, 'person', 'people')}.`];

        if (dropped) {
            parts.push(`${dropped} past the limit were left out.`);
        }

        if (duplicates.length) {
            parts.push(
                `Ignored a repeated heading: ${duplicates.join(', ')}.`
            );
        }

        return parts.join(' ');
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
