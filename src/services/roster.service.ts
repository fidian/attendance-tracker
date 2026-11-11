import { di } from '../di';
import { ConfigService } from './config.service';
import { FirebaseService } from './firebase.service';
import { ROSTER_LIMIT } from '../config';

export interface Person {
    id: string;
    /** What the list shows. The sheet's first column, or typed by hand. */
    display: string;
    /** Every other column, kept so an export round-trips. */
    extra: Record<string, string>;
    present: boolean;
}

/** A person before the database has given them an id. */
export type NewPerson = Omit<Person, 'id'>;

export type RosterListener = (people: Person[]) => void;

/**
 * Display names as typed are kept, but two that differ only by case or by
 * runs of whitespace are the same person.
 */
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

const compareKey = (name: string) => normalizeName(name).toLowerCase();

/** Alphabetical, always. Nothing reorders under a thumb mid-meeting. */
export const byDisplay = (a: Person, b: Person) =>
    a.display.localeCompare(b.display, undefined, { sensitivity: 'base' }) ||
    a.id.localeCompare(b.id);

const asExtra = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    const extra: Record<string, string> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (typeof item === 'string') {
            extra[key] = item;
        } else if (typeof item === 'number' || typeof item === 'boolean') {
            // A sheet column of numbers arrives as numbers; keep it readable.
            extra[key] = String(item);
        }
    }

    return extra;
};

/** Anything unreadable is skipped rather than taking the screen down. */
export const toPerson = (id: string, raw: unknown): Person | null => {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const stored = raw as { display?: unknown; extra?: unknown; present?: unknown };
    const display =
        typeof stored.display === 'string' ? normalizeName(stored.display) : '';

    if (!display) {
        return null;
    }

    return {
        id,
        display,
        extra: asExtra(stored.extra),
        present: stored.present === true,
    };
};

export const toPeople = (raw: unknown): Person[] => {
    if (!raw || typeof raw !== 'object') {
        return [];
    }

    return Object.entries(raw as Record<string, unknown>)
        .map(([id, value]) => toPerson(id, value))
        .filter((person): person is Person => !!person)
        .sort(byDisplay);
};

/** What goes to the database. The id is the key, so it is not in the value. */
export const fromPerson = (person: NewPerson) => ({
    display: normalizeName(person.display),
    extra: person.extra,
    present: person.present,
});

/**
 * Copying an event brings the people but not the attendance. Who was at last
 * week's meeting says nothing about who is at this one.
 */
export const forCopy = (people: Person[]): NewPerson[] =>
    people.map(person => ({
        display: person.display,
        extra: { ...person.extra },
        present: false,
    }));

/**
 * The questions a person can be given answers to, in the order they are
 * asked. The event's own `columns` lead, because that is the only record of
 * the order the import had; object key order is not preserved on read, so a
 * scan alone could never put them back.
 *
 * The scan exists for a roster that did not arrive through an import -- a
 * restored backup, or a record written by an older build. Without it, an
 * event whose people carry `Dept` but whose `columns` is empty would offer
 * nowhere to type one.
 */
export const extraFields = (columns: string[], people: Person[]): string[] => {
    const fields: string[] = [];
    const seen = new Set<string>();

    for (const column of columns) {
        if (column && !seen.has(column)) {
            seen.add(column);
            fields.push(column);
        }
    }

    const found = new Set<string>();

    for (const person of people) {
        for (const key of Object.keys(person.extra)) {
            if (key && !seen.has(key)) {
                found.add(key);
            }
        }
    }

    // Sorted, because the order they were read in means nothing.
    return [...fields, ...[...found].sort()];
};

/** Blank answers are not worth storing, and read back the same either way. */
export const trimExtra = (
    fields: string[],
    values: Record<string, string>
): Record<string, string> => {
    const extra: Record<string, string> = {};

    for (const field of fields) {
        const value = (values[field] || '').trim();

        if (value) {
            extra[field] = value;
        }
    }

    return extra;
};

/**
 * Keeps the roster the screen is showing, updated one child at a time.
 *
 * This is where the live updates land, and it is pure so it can be tested
 * without a database: the service feeds it what Firebase reports and reads
 * back a sorted list.
 */
export class RosterTable {
    private _byId = new Map<string, Person>();

    upsert(id: string, raw: unknown): boolean {
        const person = toPerson(id, raw);

        if (!person) {
            return this.remove(id);
        }

        this._byId.set(id, person);

        return true;
    }

    remove(id: string): boolean {
        return this._byId.delete(id);
    }

    clear() {
        this._byId.clear();
    }

    get(id: string) {
        return this._byId.get(id);
    }

    /** True when somebody with this display name is already listed. */
    has(display: string) {
        const key = compareKey(display);

        return [...this._byId.values()].some(
            person => compareKey(person.display) === key
        );
    }

    get size() {
        return this._byId.size;
    }

    list(): Person[] {
        return [...this._byId.values()].sort(byDisplay);
    }
}

export class RosterService {
    private _configService = di(ConfigService);
    private _firebaseService = di(FirebaseService);

    private _path(eventId: string, personId = '') {
        const base = `${this._configService.groupPath()}/roster/${eventId}`;

        return personId ? `${base}/${personId}` : base;
    }

    list(eventId: string): Promise<Person[]> {
        return this._firebaseService
            .read<unknown>(this._path(eventId))
            .then(toPeople);
    }

    /**
     * Live, one child at a time. Watching the whole subtree would re-send
     * every person on every tap, to every device looking at the event.
     */
    watch(eventId: string, listener: RosterListener): () => void {
        const table = new RosterTable();
        const emit = () => listener(table.list());

        return this._firebaseService.watchChildren(this._path(eventId), {
            added: (id, raw) => {
                table.upsert(id, raw);
                emit();
            },
            changed: (id, raw) => {
                table.upsert(id, raw);
                emit();
            },
            removed: id => {
                table.remove(id);
                emit();
            },
            // An event with nobody on it fires no child events at all, so
            // without this the screen would wait for a first list forever.
            ready: emit,
        });
    }

    add(eventId: string, person: NewPerson): Promise<string> {
        const display = normalizeName(person.display);

        if (!display) {
            return Promise.reject(new Error('A person needs a name.'));
        }

        return this._firebaseService.append(
            this._path(eventId),
            fromPerson({ ...person, display })
        );
    }

    /**
     * Edits who somebody is, never whether they are here. `present` is left
     * out of the write on purpose: it belongs to the tap, and a form saved
     * from a stale screen would otherwise undo somebody else's mark.
     */
    update(
        eventId: string,
        personId: string,
        person: Pick<Person, 'display' | 'extra'>
    ): Promise<void> {
        const display = normalizeName(person.display);

        if (!display) {
            return Promise.reject(new Error('A person needs a name.'));
        }

        return this._firebaseService.writeMany(this._path(eventId, personId), {
            display,
            extra: person.extra,
        });
    }

    /** One write, so the screen does not redraw once per person. */
    removeMany(eventId: string, ids: string[]): Promise<void> {
        if (!ids.length) {
            return Promise.resolve();
        }

        return this._firebaseService.writeMany(
            this._path(eventId),
            Object.fromEntries(ids.map(id => [id, null]))
        );
    }

    setPresent(eventId: string, personId: string, present: boolean) {
        return this._firebaseService.write(
            `${this._path(eventId, personId)}/present`,
            present
        );
    }

    /**
     * Swaps the whole roster, as an import does. Returns how many were left
     * out for being over the limit so the screen can say so.
     */
    async replaceAll(eventId: string, people: NewPerson[]): Promise<number> {
        const kept = people.slice(0, ROSTER_LIMIT);
        const written: Record<string, unknown> = {};

        for (const [index, person] of kept.entries()) {
            // Keys are generated here rather than by push() so the whole
            // roster lands in a single write.
            written[`p${String(index).padStart(5, '0')}`] = fromPerson(person);
        }

        await this._firebaseService.write(this._path(eventId), written);

        return people.length - kept.length;
    }
}
