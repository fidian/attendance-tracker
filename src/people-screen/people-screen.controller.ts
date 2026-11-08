/**
 * Split from the `component()` call so the behavior is testable under Node.
 * See AGENTS.md.
 */
import { di } from '../di';
import { ROSTER_LIMIT } from '../config';
import { plural } from '../services/text';
import { EventService, type AttendanceEvent } from '../services/event.service';
import { NavigationService } from '../services/navigation.service';
import {
    normalizeName,
    RosterService,
    type Person,
} from '../services/roster.service';

const TOAST_MS = 4000;

export class PeopleScreenComponent {
    private _eventService = di(EventService);
    private _navigationService = di(NavigationService);
    private _rosterService = di(RosterService);
    private _toastTimer?: ReturnType<typeof setTimeout>;
    private _unsubscribeNav?: () => void;
    private _unwatch?: () => void;

    busy = false;
    error = '';
    event: AttendanceEvent | null = null;
    eventId = '';
    loaded = false;
    newName = '';
    people: Person[] = [];
    /** Which people are ticked. Selecting swaps the add box for a delete. */
    selected: Record<string, true> = {};
    toast = '';

    onInit() {
        // The same element is reused when the event changes underneath it,
        // so opening an event cannot live in onInit alone.
        this._unsubscribeNav = this._navigationService.subscribe(route => {
            if (route.screen === 'people' && route.eventId !== this.eventId) {
                this._open(route.eventId);
            }
        });
        this._open(this._navigationService.current().eventId);
    }

    onDestroy() {
        clearTimeout(this._toastTimer);
        this._unwatch?.();
        this._unsubscribeNav?.();
    }

    private _open(eventId: string) {
        this._unwatch?.();
        this.eventId = eventId;
        this.event = null;
        this.people = [];
        this.selected = {};
        this.loaded = false;
        this.error = '';
        this._unwatch = this._rosterService.watch(eventId, people => {
            this.people = people;
            this.loaded = true;
            this._forgetMissing(people);
        });
        this._eventService
            .find(eventId)
            .then(event => {
                this.event = event;
            })
            .catch(error => {
                this.error = this._message(error);
            });
    }

    /** Somebody removed on another phone must not stay ticked here. */
    private _forgetMissing(people: Person[]) {
        const alive = new Set(people.map(person => person.id));
        const selected: Record<string, true> = {};

        for (const id of Object.keys(this.selected)) {
            if (alive.has(id)) {
                selected[id] = true;
            }
        }

        this.selected = selected;
    }

    title(event: AttendanceEvent | null) {
        return event?.name || 'Roster';
    }

    back() {
        this._navigationService.go('event', this.eventId);
    }

    isSelected(id: string, selected: Record<string, true>) {
        return !!selected[id];
    }

    selectedCount(selected: Record<string, true>) {
        return Object.keys(selected).length;
    }

    anySelected(selected: Record<string, true>) {
        return this.selectedCount(selected) > 0;
    }

    toggleSelected(person: Person) {
        const selected = { ...this.selected };

        if (selected[person.id]) {
            delete selected[person.id];
        } else {
            selected[person.id] = true;
        }

        this.selected = selected;
    }

    clearSelection() {
        this.selected = {};
    }

    setNewName(text: string) {
        this.newName = text;
        this.error = '';
    }

    canAdd(newName: string, busy: boolean) {
        return !!newName.trim() && !busy;
    }

    /**
     * A hand-added person carries no extra columns. Their row still exports,
     * with those cells empty, because the event remembers the column order
     * rather than each person doing so.
     */
    async addPerson() {
        const display = normalizeName(this.newName);

        if (!display || this.busy) {
            return;
        }

        if (this.people.length >= ROSTER_LIMIT) {
            this.error = `This roster holds ${ROSTER_LIMIT} people.`;

            return;
        }

        this.busy = true;

        try {
            await this._rosterService.add(this.eventId, {
                display,
                extra: {},
                present: false,
            });
            this.newName = '';
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    async deleteSelected() {
        const ids = Object.keys(this.selected);

        if (!ids.length || this.busy) {
            return;
        }

        this.busy = true;

        try {
            await this._rosterService.removeMany(this.eventId, ids);
            this.selected = {};
            this._showToast(`Removed ${plural(ids.length, 'person', 'people')}.`);
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
