import { di } from '../di';
import { ConfigService } from './config.service';
import { FirebaseService } from './firebase.service';

export interface AttendanceEvent {
    id: string;
    name: string;
    /** Import header order. Object key order is not preserved on read. */
    columns: string[];
    createdAt: number;
}

export type EventListener = (events: AttendanceEvent[]) => void;

/** Stored shape, which is deliberately not the shape the app passes around. */
interface StoredEvent {
    name?: unknown;
    columns?: unknown;
    createdAt?: unknown;
}

const asStrings = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];

/**
 * A record written by an older build, or by hand, must not take the screen
 * down. Anything unreadable becomes a sensible default.
 */
export const toEvent = (id: string, raw: unknown): AttendanceEvent | null => {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const stored = raw as StoredEvent;
    const name = typeof stored.name === 'string' ? stored.name.trim() : '';

    if (!name) {
        return null;
    }

    return {
        id,
        name,
        columns: asStrings(stored.columns),
        createdAt:
            typeof stored.createdAt === 'number' ? stored.createdAt : 0,
    };
};

export const toEvents = (raw: unknown): AttendanceEvent[] => {
    if (!raw || typeof raw !== 'object') {
        return [];
    }

    return Object.entries(raw as Record<string, unknown>)
        .map(([id, value]) => toEvent(id, value))
        .filter((event): event is AttendanceEvent => !!event)
        .sort(byNewest);
};

/** Newest first: the meeting you are about to take is the one you want. */
export const byNewest = (a: AttendanceEvent, b: AttendanceEvent) =>
    b.createdAt - a.createdAt ||
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** `2026-11-08 Sample Event`, from the device's own date. */
export const defaultEventName = (
    on = new Date(),
    suffix = 'Sample Event'
) => {
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${on.getFullYear()}-${pad(on.getMonth() + 1)}-${pad(
        on.getDate()
    )} ${suffix}`;
};

export class EventService {
    private _configService = di(ConfigService);
    private _firebaseService = di(FirebaseService);

    private _path(id = '') {
        const base = `${this._configService.groupPath()}/events`;

        return id ? `${base}/${id}` : base;
    }

    list(): Promise<AttendanceEvent[]> {
        return this._firebaseService
            .read<unknown>(this._path())
            .then(toEvents);
    }

    /** The live list, for the event-selection screen. */
    watch(listener: EventListener): () => void {
        return this._firebaseService.watch(this._path(), raw =>
            listener(toEvents(raw))
        );
    }

    find(id: string): Promise<AttendanceEvent | null> {
        return this._firebaseService
            .read<unknown>(this._path(id))
            .then(raw => toEvent(id, raw));
    }

    async create(name: string, columns: string[] = []): Promise<string> {
        const trimmed = name.trim();

        if (!trimmed) {
            throw new Error('An event needs a name.');
        }

        // The group marker is what keeps a group alive once its last event is
        // deleted; the rules refuse a write that would empty a group.
        await this._firebaseService.write(
            `${this._configService.groupPath()}/meta/createdAt`,
            Date.now()
        );

        return this._firebaseService.append(this._path(), {
            name: trimmed,
            columns,
            createdAt: Date.now(),
        });
    }

    rename(id: string, name: string): Promise<void> {
        const trimmed = name.trim();

        if (!trimmed) {
            return Promise.reject(new Error('An event needs a name.'));
        }

        return this._firebaseService.write(`${this._path(id)}/name`, trimmed);
    }

    /**
     * The event and its roster go together, in one all-or-nothing write. The
     * two are stored as siblings rather than nested so that listing events
     * does not drag every person of every event down the wire.
     */
    remove(id: string): Promise<void> {
        return this._firebaseService.writeMany(
            this._configService.groupPath(),
            {
                [`events/${id}`]: null,
                [`roster/${id}`]: null,
            }
        );
    }

    setColumns(id: string, columns: string[]): Promise<void> {
        return this._firebaseService.write(
            `${this._path(id)}/columns`,
            columns
        );
    }
}
