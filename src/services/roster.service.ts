import { LocalStorageService } from './local-storage.service';
import type { LocalStorageInterface } from './local-storage.service';
import { ROSTER_LIMIT } from '../config';

/** One row of the roster. */
export interface Person {
    /** What the list shows. The CSV's first column, or typed by hand. */
    label: string;
    /** Field label to value, so a roster outlives a change of entry ids. */
    values: Record<string, string>;
}

export type RosterListener = (people: Person[]) => void;

export type AddResult = 'added' | 'known' | 'full';

const isPersonList = (value: Person[]) =>
    Array.isArray(value) &&
    value.every(
        person =>
            !!person &&
            typeof person.label === 'string' &&
            !!person.label &&
            !!person.values &&
            typeof person.values === 'object' &&
            !Array.isArray(person.values) &&
            Object.values(person.values).every(v => typeof v === 'string')
    );

/**
 * Labels as typed are kept for display, but two that differ only by case or
 * by runs of whitespace are the same person.
 */
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

const compareKey = (name: string) => normalizeName(name).toLowerCase();

const byLabel = (a: Person, b: Person) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });

/**
 * The people on the screen, always in alphabetical order by label.
 *
 * The order never depends on what was tapped, so a row cannot move out from
 * under a thumb. That also means there is no recency to evict by, so a full
 * roster refuses a new row rather than quietly dropping one.
 */
export class RosterService {
    private _listeners = new Set<RosterListener>();
    private _people: Person[];
    private _storage: LocalStorageInterface<Person[]>;

    constructor() {
        this._storage = LocalStorageService.json<Person[]>(
            'roster',
            1,
            isPersonList
        );
        this._people = this._tidy(this._storage.getItem() || []);
    }

    getPeople(): Person[] {
        return this._people;
    }

    isFull() {
        return this._people.length >= ROSTER_LIMIT;
    }

    find(label: string): Person | undefined {
        const key = compareKey(label);

        return this._people.find(person => compareKey(person.label) === key);
    }

    has(label: string) {
        return !!this.find(label);
    }

    add(person: Person): AddResult {
        const label = normalizeName(person.label);

        if (!label) {
            return 'known';
        }

        if (this.has(label)) {
            return 'known';
        }

        if (this.isFull()) {
            return 'full';
        }

        this._save([...this._people, { ...person, label }]);

        return 'added';
    }

    remove(label: string): Person[] {
        const key = compareKey(label);
        this._save(
            this._people.filter(person => compareKey(person.label) !== key)
        );

        return this._people;
    }

    /**
     * Swaps the whole roster for an imported one. Returns how many rows were
     * dropped for being over the limit, so the screen can say so.
     */
    replaceAll(people: Person[]): number {
        const tidied = this._tidy(people);
        this._save(tidied);

        return Math.max(0, people.length - tidied.length);
    }

    subscribe(listener: RosterListener): () => void {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    private _save(people: Person[]) {
        this._people = this._tidy(people);
        this._storage.setItem(this._people);

        for (const listener of this._listeners) {
            listener(this._people);
        }
    }

    /** Drops blanks and duplicates, sorts, then trims to the limit. */
    private _tidy(people: Person[]): Person[] {
        const seen = new Set<string>();
        const tidied: Person[] = [];

        for (const person of people) {
            const label = normalizeName(person.label || '');
            const key = compareKey(label);

            if (label && !seen.has(key)) {
                seen.add(key);
                tidied.push({ label, values: { ...person.values } });
            }
        }

        return tidied.sort(byLabel).slice(0, ROSTER_LIMIT);
    }
}
