import { deleteApp, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
    get,
    getDatabase,
    off,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onValue,
    push,
    ref,
    remove,
    set,
    update,
} from 'firebase/database';
import type { Database, DataSnapshot } from 'firebase/database';

export interface ChildHandlers {
    added: (key: string, value: unknown) => void;
    changed: (key: string, value: unknown) => void;
    removed: (key: string) => void;
    /**
     * The initial children have all arrived. Child events alone cannot say
     * this: a path with nothing at it fires none of them, which is how an
     * empty roster sat on "Loading" forever. A one-time `value` listener
     * fires in both cases, and after every initial `child_added`.
     */
    ready: () => void;
}

/**
 * The only file that touches the Firebase SDK.
 *
 * It is deliberately thin and holds no decisions. The SDK talks over a
 * WebSocket, which cannot be stubbed the way `fetch` can, so everything that
 * is worth asserting lives in the services above this one and this file is
 * kept small enough to be checked by reading it. See AGENTS.md.
 *
 * Only `databaseURL` is passed to `initializeApp`: Realtime Database needs
 * nothing else when the rules do not consult `auth`, which keeps the shared
 * QR code down to one address and one group id.
 */
export class FirebaseService {
    private _app: FirebaseApp | null = null;
    private _database: Database | null = null;
    private _url = '';

    /** Idempotent: connecting to the address already in use does nothing. */
    connect(databaseUrl: string) {
        if (this._url === databaseUrl && this._database) {
            return;
        }

        this.disconnect();
        this._app = initializeApp({ databaseURL: databaseUrl }, 'attendance');
        this._database = getDatabase(this._app);
        this._url = databaseUrl;
    }

    disconnect() {
        const app = this._app;
        this._app = null;
        this._database = null;
        this._url = '';

        if (app) {
            // Resolves after the socket closes; nothing waits on it.
            deleteApp(app).catch(() => {});
        }
    }

    isReady() {
        return !!this._database;
    }

    async read<T>(path: string): Promise<T | null> {
        const snapshot = await get(this._ref(path));

        return snapshot.exists() ? (snapshot.val() as T) : null;
    }

    write(path: string, value: unknown): Promise<void> {
        return set(this._ref(path), value);
    }

    /**
     * Several paths at once, all or nothing. A key mapped to `null` is
     * removed, which is how an event and its roster go together.
     */
    writeMany(path: string, values: Record<string, unknown>): Promise<void> {
        return update(this._ref(path), values);
    }

    async append(path: string, value: unknown): Promise<string> {
        const child = push(this._ref(path));
        await set(child, value);

        return child.key as string;
    }

    remove(path: string): Promise<void> {
        return remove(this._ref(path));
    }

    /** Fires with the whole subtree, now and on every change. */
    watch(path: string, listener: (value: unknown) => void): () => void {
        const reference = this._ref(path);
        const handler = (snapshot: DataSnapshot) =>
            listener(snapshot.exists() ? snapshot.val() : null);
        onValue(reference, handler);

        return () => off(reference, 'value', handler);
    }

    /**
     * Fires per child rather than per subtree. A roster of 250 people would
     * otherwise come down the wire in full on every single tap, on every
     * device watching.
     */
    watchChildren(path: string, handlers: ChildHandlers): () => void {
        const reference = this._ref(path);
        const added = (s: DataSnapshot) => handlers.added(s.key as string, s.val());
        const changed = (s: DataSnapshot) =>
            handlers.changed(s.key as string, s.val());
        const removed = (s: DataSnapshot) => handlers.removed(s.key as string);
        onChildAdded(reference, added);
        onChildChanged(reference, changed);
        onChildRemoved(reference, removed);
        onValue(reference, () => handlers.ready(), { onlyOnce: true });

        return () => {
            off(reference, 'child_added', added);
            off(reference, 'child_changed', changed);
            off(reference, 'child_removed', removed);
        };
    }

    private _ref(path: string) {
        if (!this._database) {
            throw new Error('Not connected to a database.');
        }

        return ref(this._database, path);
    }
}
