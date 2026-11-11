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
    extraFields,
    normalizeName,
    RosterService,
    trimExtra,
    type Person,
} from '../services/roster.service';

export type PeopleView = 'list' | 'edit';

const TOAST_MS = 4000;

export class PeopleScreenComponent {
    private _eventService = di(EventService);
    private _navigationService = di(NavigationService);
    private _rosterService = di(RosterService);
    private _toastTimer?: ReturnType<typeof setTimeout>;
    private _unsubscribeNav?: () => void;
    private _unwatch?: () => void;

    busy = false;
    /** Who is being edited, and what has been typed so far. */
    editExtra: Record<string, string> = {};
    editId = '';
    editName = '';
    error = '';
    event: AttendanceEvent | null = null;
    eventId = '';
    /** The questions this roster asks, beyond the name. */
    fields: string[] = [];
    loaded = false;
    newExtra: Record<string, string> = {};
    newName = '';
    people: Person[] = [];
    /** Which people are ticked. Selecting swaps the add box for a delete. */
    selected: Record<string, true> = {};
    toast = '';
    view: PeopleView = 'list';

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
        this.fields = [];
        this.loaded = false;
        this.error = '';
        this.view = 'list';
        this.newName = '';
        this.newExtra = {};
        this._unwatch = this._rosterService.watch(eventId, people => {
            this.people = people;
            this.loaded = true;
            this._forgetMissing(people);
            this._syncFields();

            // Somebody removed them on another phone while this was open.
            if (this.view === 'edit' && !people.some(p => p.id === this.editId)) {
                this.view = 'list';
                this._showToast('That person was removed on another device.');
            }
        });
        this._eventService
            .find(eventId)
            .then(event => {
                this.event = event;
                this._syncFields();
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

    /**
     * The event's columns are the order of record; the roster is scanned so
     * a field nobody wrote down is still offered. Both arrive asynchronously
     * and in either order, so this runs on each.
     */
    private _syncFields() {
        this.fields = extraFields(this.event?.columns || [], this.people);
    }

    hasFields(fields: string[]) {
        return fields.length > 0;
    }

    showEmpty(view: PeopleView, loaded: boolean, people: Person[]) {
        return view === 'list' && loaded && !people.length;
    }

    showLoading(view: PeopleView, loaded: boolean) {
        return view === 'list' && !loaded;
    }

    showAdd(view: PeopleView, selected: Record<string, true>) {
        return view === 'list' && !this.anySelected(selected);
    }

    showSelection(view: PeopleView, selected: Record<string, true>) {
        return view === 'list' && this.anySelected(selected);
    }

    /**
     * The questions appear once a name is being typed. Manage-people is also
     * where you come to delete somebody, and three empty boxes above the list
     * would push the names off a phone screen for everybody who is not adding.
     */
    showNewFields(
        view: PeopleView,
        selected: Record<string, true>,
        fields: string[],
        newName: string
    ) {
        return this.showAdd(view, selected) && !!fields.length && !!newName.trim();
    }

    /** Shared by both forms; a missing answer must read as empty, not as
     * the word "undefined". */
    valueFor(field: string, values: Record<string, string>) {
        return values[field] || '';
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

    /** Editing is for one person. Two ticked is a delete, not an edit. */
    canEdit(selected: Record<string, true>) {
        return this.selectedCount(selected) === 1;
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

    // A new object each time: a binding re-runs when a top-level identifier
    // is assigned, and mutating this one in place would change nothing.
    setNewExtra(field: string, text: string) {
        this.newExtra = { ...this.newExtra, [field]: text };
    }

    setEditName(text: string) {
        this.editName = text;
        this.error = '';
    }

    setEditExtra(field: string, text: string) {
        this.editExtra = { ...this.editExtra, [field]: text };
    }

    canAdd(newName: string, busy: boolean) {
        return !!newName.trim() && !busy;
    }

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
            const extra = trimExtra(this.fields, this.newExtra);
            await this._rememberFields();
            await this._rosterService.add(this.eventId, {
                display,
                extra,
                present: false,
            });
            this.newName = '';
            this.newExtra = {};
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    /** Opens the form on the one ticked person. */
    startEdit() {
        const id = Object.keys(this.selected)[0];
        const person = this.people.find(item => item.id === id);

        if (!person || this.busy) {
            return;
        }

        this.editId = person.id;
        this.editName = person.display;
        this.editExtra = { ...person.extra };
        this.error = '';
        this.view = 'edit';
    }

    canSave(editName: string, busy: boolean) {
        return !!editName.trim() && !busy;
    }

    async saveEdit() {
        const display = normalizeName(this.editName);

        if (!display || !this.editId || this.busy) {
            return;
        }

        this.busy = true;

        try {
            const extra = trimExtra(this.fields, this.editExtra);
            await this._rememberFields();
            await this._rosterService.update(this.eventId, this.editId, {
                display,
                extra,
            });
            this.selected = {};
            this.view = 'list';
            this._showToast('Saved.');
        } catch (error) {
            this.error = this._message(error);
        }

        this.busy = false;
    }

    cancelEdit() {
        this.view = 'list';
        this.error = '';
    }

    /**
     * An answer is only exported if the event lists the question, so a field
     * that was found by scanning rather than by import is written down the
     * first time somebody adds or edits. Otherwise the value would be stored
     * and then quietly left out of every export.
     *
     * The whole scan is recorded, not just the questions this one person
     * answered: the others are asked of everybody already on the roster, and
     * recording a subset would drop their answers from the next export.
     */
    private async _rememberFields() {
        const columns = this.event?.columns || [];
        const next = this.fields;

        if (!this.event || next.length === columns.length) {
            return;
        }

        await this._eventService.setColumns(this.eventId, next);
        this.event = { ...this.event, columns: next };
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
