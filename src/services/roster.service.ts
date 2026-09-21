import { LocalStorageService } from './local-storage.service';
import type { LocalStorageInterface } from './local-storage.service';
import { RECENT_NAME_LIMIT } from '../config';

export type RosterListener = (names: string[]) => void;

export type AddResult = 'added' | 'known' | 'full';

const isStringList = (value: string[]) =>
    Array.isArray(value) && value.every(item => typeof item === 'string');

/**
 * Names as typed are kept for display, but two names that differ only by case
 * or by runs of whitespace are the same person.
 */
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

const compareKey = (name: string) => normalizeName(name).toLowerCase();

const byName = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * The list of names on the screen, always in alphabetical order.
 *
 * The order never depends on what was tapped, so a row cannot move out from
 * under a thumb: someone marking a dozen people in a row finds every name
 * exactly where it was. That also means there is no recency to evict by, so a
 * full list refuses new names rather than quietly dropping one.
 */
export class RosterService {
    private _listeners = new Set<RosterListener>();
    private _names: string[];
    private _storage: LocalStorageInterface<string[]>;

    constructor() {
        this._storage = LocalStorageService.json<string[]>(
            'recentNames',
            1,
            isStringList
        );
        this._names = this._tidy(this._storage.getItem() || []);
    }

    getNames(): string[] {
        return this._names;
    }

    isFull() {
        return this._names.length >= RECENT_NAME_LIMIT;
    }

    has(name: string) {
        const key = compareKey(name);

        return this._names.some(existing => compareKey(existing) === key);
    }

    add(name: string): AddResult {
        const normalized = normalizeName(name);

        if (!normalized || this.has(normalized)) {
            return 'known';
        }

        if (this.isFull()) {
            return 'full';
        }

        this._save([...this._names, normalized]);

        return 'added';
    }

    remove(name: string): string[] {
        const key = compareKey(name);
        this._save(
            this._names.filter(existing => compareKey(existing) !== key)
        );

        return this._names;
    }

    subscribe(listener: RosterListener): () => void {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    private _save(names: string[]) {
        this._names = this._tidy(names);
        this._storage.setItem(this._names);

        for (const listener of this._listeners) {
            listener(this._names);
        }
    }

    /** Drops blanks and duplicates, sorts, then trims to the limit. */
    private _tidy(names: string[]): string[] {
        const seen = new Set<string>();
        const tidied: string[] = [];

        for (const name of names) {
            const normalized = normalizeName(name);
            const key = compareKey(normalized);

            if (normalized && !seen.has(key)) {
                seen.add(key);
                tidied.push(normalized);
            }
        }

        return tidied.sort(byName).slice(0, RECENT_NAME_LIMIT);
    }
}
