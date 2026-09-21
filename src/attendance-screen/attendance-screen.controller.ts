/**
 * The controller lives apart from the `component()` call because `component()`
 * needs a real DOM to scope its styles, which keeps the whole module from
 * loading under Node. Split this way, the behavior below is unit-testable
 * without a browser.
 */
import { emit } from 'fudgel';
import { di } from '../di';
import { AttendanceService } from '../services/attendance.service';
import { normalizeName, RosterService } from '../services/roster.service';
import { RECENT_NAME_LIMIT } from '../config';
import { OnlineService } from '../services/online.service';

const TOAST_MS = 4000;

/**
 * A round trip to Google can finish in well under the time it takes to see
 * anything, so a name stays lit at least this long. Without it a tap on a
 * fast connection looks like nothing happened.
 */
export const MIN_HIGHLIGHT_MS = 300;

export class AttendanceScreenComponent {
    private _attendanceService = di(AttendanceService);
    private _onlineService = di(OnlineService);
    private _rosterService = di(RosterService);
    private _toastTimer?: ReturnType<typeof setTimeout>;
    private _unsubscribe: (() => void)[] = [];

    list?: HTMLElement;
    /** The names whose entry is in flight, kept lit until it lands. */
    marking: Record<string, true> = {};
    names: string[] = [];
    online = true;
    toast = '';

    onInit() {
        this.names = this._rosterService.getNames();
        this.online = this._onlineService.isOnline();
        this._unsubscribe.push(
            this._rosterService.subscribe(names => {
                this.names = names;
            }),
            this._onlineService.subscribe(online => {
                this.online = online;
            })
        );
    }

    onDestroy() {
        clearTimeout(this._toastTimer);

        for (const unsubscribe of this._unsubscribe) {
            unsubscribe();
        }
    }

    isMarking(name: string, marking: Record<string, true>) {
        return !!marking[name];
    }

    isBusy(name: string, marking: Record<string, true>, online: boolean) {
        return !online || !!marking[name];
    }

    /**
     * Tapping a name is the whole interaction: it lights up and posts.
     * Dropping the highlight once the post lands is what starts the fade; the
     * stylesheet does the rest. Nothing reorders, so the row under a thumb
     * stays where it is.
     */
    async mark(name: string) {
        const normalized = normalizeName(name);

        if (!normalized || this.marking[normalized] || !this.online) {
            return;
        }

        this.marking = { ...this.marking, [normalized]: true };

        const [result] = await Promise.all([
            this._attendanceService.submit(normalized),
            new Promise(resolve => setTimeout(resolve, MIN_HIGHLIGHT_MS)),
        ]);

        const marking = { ...this.marking };
        delete marking[normalized];
        this.marking = marking;

        // An entry that went out needs no words; the fade said it. One that
        // did not has to say so, because nothing was recorded.
        if (result === 'failed') {
            this._showToast(
                `${normalized} was not sent. Check the connection and tap again.`
            );
        }
    }

    /** Puts a typed name on the list, then marks that person straight away. */
    addName(name: string) {
        const normalized = normalizeName(name);
        const result = this._rosterService.add(normalized);

        if (result === 'full') {
            this._showToast(
                `The list holds ${RECENT_NAME_LIMIT} names. Remove one with its trash can to make room.`
            );

            return Promise.resolve();
        }

        this._scrollIntoView(normalized);

        return this.mark(normalized);
    }

    remove(name: string) {
        this._rosterService.remove(name);
    }

    openSettings() {
        emit(this, 'settingsOpen');
    }

    /** A new name lands in alphabetical order, which may be off screen. */
    private _scrollIntoView(name: string) {
        setTimeout(() => {
            const rows = this.list?.querySelectorAll<HTMLElement>('.name');
            const row = [...(rows || [])].find(
                element => element.dataset.name === name
            );
            row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
