import { CONFIG_HASH_KEY, GROUP_HASH_KEY } from '../config';
import { LocalStorageService } from './local-storage.service';
import type { LocalStorageInterface } from './local-storage.service';

/** Everything this device needs to reach its data. */
export interface Connection {
    /** The Realtime Database address, with no trailing slash or path. */
    databaseUrl: string;
    /** Which group inside that database. Secret; see the README. */
    groupId: string;
}

export type ConfigListener = (connection: Connection | null) => void;

/**
 * The same shape the database rules enforce. Keeping the two in step matters:
 * a group id this accepts but the rules reject would look like a connection
 * failure rather than a bad id.
 */
export const GROUP_ID_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

const DATABASE_HOST =
    /^[a-z0-9-]+\.(firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)$/i;

/**
 * 16 random bytes, base64url, which is 22 characters and 128 bits. Long
 * enough that guessing is hopeless, short enough to keep the shared QR code
 * easy to scan.
 */
export const newGroupId = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

/**
 * Accepts what somebody actually copies out of the Firebase console, which
 * may carry a path, a query or a trailing slash, and reduces it to the bare
 * origin. Returns null for anything that is not a Realtime Database address,
 * so a Firestore URL or a typo is refused at the point of entry.
 */
export const normalizeDatabaseUrl = (text: string): string | null => {
    const trimmed = (text || '').trim();

    if (!trimmed) {
        return null;
    }

    let url: URL;

    try {
        url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    } catch (_ignore) {
        return null;
    }

    if (url.protocol !== 'https:' || !DATABASE_HOST.test(url.hostname)) {
        return null;
    }

    return `https://${url.hostname.toLowerCase()}`;
};

export const isConnection = (value: Connection) =>
    !!value &&
    typeof value.databaseUrl === 'string' &&
    normalizeDatabaseUrl(value.databaseUrl) === value.databaseUrl &&
    typeof value.groupId === 'string' &&
    GROUP_ID_PATTERN.test(value.groupId);

/** The fragment a shared QR code carries, without the leading `#`. */
export const serializeConnection = (connection: Connection) =>
    `${CONFIG_HASH_KEY}=${encodeURIComponent(connection.databaseUrl)}` +
    `&${GROUP_HASH_KEY}=${encodeURIComponent(connection.groupId)}`;

export const deserializeConnection = (hash: string): Connection | null => {
    const text = hash || '';
    const read = (key: string) => {
        const match = new RegExp(`(?:^|[#&?])${key}=([^&#]+)`).exec(text);

        return match ? decodeURIComponent(match[1]) : '';
    };
    const databaseUrl = normalizeDatabaseUrl(read(CONFIG_HASH_KEY));
    const connection = { databaseUrl: databaseUrl || '', groupId: read(GROUP_HASH_KEY) };

    return isConnection(connection) ? connection : null;
};

export class ConfigService {
    private _connection: Connection | null;
    private _listeners = new Set<ConfigListener>();
    private _storage: LocalStorageInterface<Connection>;

    constructor() {
        this._storage = LocalStorageService.json<Connection>(
            'connection',
            1,
            isConnection
        );
        this._connection = this._storage.getItem();
    }

    get(): Connection | null {
        return this._connection;
    }

    isConfigured() {
        return !!this._connection;
    }

    databaseUrl() {
        return this._connection?.databaseUrl || '';
    }

    groupId() {
        return this._connection?.groupId || '';
    }

    /** The path everything this device touches hangs from. */
    groupPath() {
        return this._connection ? `groups/${this._connection.groupId}` : '';
    }

    set(connection: Connection): boolean {
        if (!isConnection(connection)) {
            return false;
        }

        this._connection = connection;
        this._storage.setItem(connection);
        this._notify();

        return true;
    }

    clear() {
        this._connection = null;
        this._storage.reset();
        this._notify();
    }

    /**
     * The URL a shared QR code encodes: this app, carrying the connection. A
     * phone camera opens it and the app configures itself on load.
     */
    shareUrl(appUrl = location.href) {
        if (!this._connection) {
            return null;
        }

        return `${appUrl.split('#')[0].split('?')[0]}#${serializeConnection(
            this._connection
        )}`;
    }

    /**
     * Reads a connection handed over in the address bar and keeps it.
     *
     * Adopting silently is right for a device being set up, which is the
     * whole point of the shared code. It is wrong for a device that already
     * has one: a link sent to a leader who is already set up would quietly
     * point their phone at somebody else's database, and the evening's
     * attendance would be taken into it. So replacing a *different*
     * connection asks first, and is the only time it does.
     */
    adoptFromHash(
        hash = location.hash,
        confirmReplace: (next: Connection, current: Connection) => boolean = () =>
            false
    ): boolean {
        const connection = deserializeConnection(hash);

        if (!connection) {
            return false;
        }

        const current = this._connection;
        const differs =
            !!current &&
            (current.databaseUrl !== connection.databaseUrl ||
                current.groupId !== connection.groupId);

        if (differs && !confirmReplace(connection, current)) {
            return false;
        }

        return this.set(connection);
    }

    subscribe(listener: ConfigListener): () => void {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    private _notify() {
        for (const listener of this._listeners) {
            listener(this._connection);
        }
    }
}
