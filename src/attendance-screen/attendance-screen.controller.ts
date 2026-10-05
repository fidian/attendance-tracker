/**
 * The controller lives apart from the `component()` call because `component()`
 * needs a real DOM to scope its styles, which keeps the whole module from
 * loading under Node. Split this way, the behavior below is unit-testable
 * without a browser.
 */
import { emit } from 'fudgel';
import { di } from '../di';
import { ROSTER_LIMIT } from '../config';
import { AttendanceService } from '../services/attendance.service';
import { ConfigService } from '../services/config.service';
import { CsvService } from '../services/csv.service';
import type { FormField } from '../services/config.service';
import { normalizeName, RosterService } from '../services/roster.service';
import type { Person } from '../services/roster.service';
import { OnlineService } from '../services/online.service';

const TOAST_MS = 4000;

/**
 * A round trip to Google can finish in well under the time it takes to see
 * anything, so a row stays lit at least this long. Without it a tap on a
 * fast connection looks like nothing happened.
 */
export const MIN_HIGHLIGHT_MS = 300;

export class AttendanceScreenComponent {
    private _attendanceService = di(AttendanceService);
    private _configService = di(ConfigService);
    private _csvService = di(CsvService);
    private _onlineService = di(OnlineService);
    private _rosterService = di(RosterService);
    private _people: Person[] = [];
    private _toastTimer?: ReturnType<typeof setTimeout>;
    private _unsubscribe: (() => void)[] = [];

    /** True while the add form is open. */
    adding = false;
    editing = false;
    fields: FormField[] = [];
    filter = '';
    list?: HTMLElement;
    /** The labels whose entry is in flight, kept lit until it lands. */
    marking: Record<string, true> = {};
    online = true;
    /** What the list shows: everyone, or everyone matching the filter. */
    shown: Person[] = [];
    toast = '';

    onInit() {
        this.fields = this._configService.fields();
        this._people = this._rosterService.getPeople();
        this.online = this._onlineService.isOnline();
        this._applyFilter();
        this._unsubscribe.push(
            this._rosterService.subscribe(people => {
                this._people = people;
                this._applyFilter();
            }),
            this._onlineService.subscribe(online => {
                this.online = online;
            })
        );
        this._importOnFirstRun();
    }

    /**
     * A device set up by scanning a code arrives with a sheet address and an
     * empty roster, which would otherwise be a dead end: the screen would be
     * blank until someone found the Import button in settings. Only an empty
     * roster is filled this way, so a later visit never overwrites edits.
     */
    private async _importOnFirstRun() {
        const url = this._configService.csvUrl();

        if (!url || this._people.length || !this.online) {
            return;
        }

        try {
            const result = await this._csvService.fetchPeople(
                url,
                this._configService.fieldLabels()
            );
            this._rosterService.replaceAll(result.people);
        } catch (error) {
            this._showToast(
                `Could not load the roster sheet. ${(error as Error).message}`
            );
        }
    }

    onDestroy() {
        clearTimeout(this._toastTimer);

        for (const unsubscribe of this._unsubscribe) {
            unsubscribe();
        }
    }

    isMarking(label: string, marking: Record<string, true>) {
        return !!marking[label];
    }

    isBusy(
        label: string,
        marking: Record<string, true>,
        online: boolean,
        editing: boolean
    ) {
        return !online || editing || !!marking[label];
    }

    setFilter(text: string) {
        this.filter = text;
        this._applyFilter();
    }

    clearFilter() {
        this.setFilter('');
    }

    /**
     * Tapping someone is the whole interaction: they light up and post.
     * Dropping the highlight once the post lands is what starts the fade; the
     * stylesheet does the rest. Nothing reorders, so the tile under a thumb
     * stays where it is.
     */
    async mark(label: string) {
        const person = this._rosterService.find(label);

        if (
            !person ||
            this.marking[person.label] ||
            !this.online ||
            this.editing
        ) {
            return;
        }

        const key = person.label;
        this.marking = { ...this.marking, [key]: true };

        const [result] = await Promise.all([
            this._attendanceService.submit(person),
            new Promise(resolve => setTimeout(resolve, MIN_HIGHLIGHT_MS)),
        ]);

        const marking = { ...this.marking };
        delete marking[key];
        this.marking = marking;

        // An entry that went out needs no words; the fade said it. One that
        // did not has to say so, because nothing was recorded.
        if (result === 'failed') {
            this._showToast(
                `${key} was not sent. Check the connection and tap again.`
            );
        }
    }

    toggleEditing() {
        this.editing = !this.editing;
        this.adding = false;
    }

    /** Opens the add form, carrying over whatever was typed in the filter. */
    startAdding() {
        if (this._rosterService.isFull()) {
            this._showToast(
                `The roster holds ${ROSTER_LIMIT} people. Remove someone to make room.`
            );

            return;
        }

        this.adding = true;
    }

    stopAdding() {
        this.adding = false;
    }

    /**
     * Takes a filled-in person from the add form. They are added and marked
     * in one go, which is what someone standing at the door wants.
     */
    addPerson(person: Person) {
        this.adding = false;
        const result = this._rosterService.add(person);

        if (result === 'full') {
            this._showToast(
                `The roster holds ${ROSTER_LIMIT} people. Remove someone to make room.`
            );

            return Promise.resolve();
        }

        this.clearFilter();
        this._scrollIntoView(normalizeName(person.label));

        return this.mark(person.label);
    }

    remove(label: string) {
        this._rosterService.remove(label);
    }

    openSettings() {
        emit(this, 'settingsOpen');
    }

    private _applyFilter() {
        const needle = normalizeName(this.filter).toLowerCase();
        this.shown = !needle
            ? this._people
            : this._people.filter(person =>
                  this._matches(person, needle)
              );
    }

    /**
     * Matches the start of any word in the label or in any field value, so
     * "by" finds "Ada Byron" and a troop number finds everyone in it.
     */
    private _matches(person: Person, needle: string) {
        const haystack = [person.label, ...Object.values(person.values)];

        return haystack.some(value =>
            value
                .toLowerCase()
                .split(/\s+/)
                .some(word => word.startsWith(needle))
        );
    }

    /** A new row lands in alphabetical order, which may be off screen. */
    private _scrollIntoView(label: string) {
        setTimeout(() => {
            const tiles = this.list?.querySelectorAll<HTMLElement>('.name');
            const tile = [...(tiles || [])].find(
                element => element.dataset.name === label
            );
            tile?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }

    private _showToast(message: string) {
        clearTimeout(this._toastTimer);
        this.toast = message;
        this._toastTimer = setTimeout(() => {
            this.toast = '';
        }, TOAST_MS);
    }
}
