export type OnlineListener = (online: boolean) => void;

/**
 * `navigator.onLine` is only ever a hint -- it says the device has a network
 * interface, not that Google is reachable. It is good enough to grey the
 * buttons out, and a post that fails anyway is reported on its own.
 */
export class OnlineService {
    private _listeners = new Set<OnlineListener>();
    private _online = true;

    constructor() {
        this._online = this._read();
    }

    isOnline() {
        return this._online;
    }

    listenForEvents() {
        for (const event of ['online', 'offline']) {
            addEventListener(event, () => {
                this._online = this._read();

                for (const listener of this._listeners) {
                    listener(this._online);
                }
            });
        }
    }

    subscribe(listener: OnlineListener): () => void {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    private _read() {
        return typeof navigator === 'undefined' || navigator.onLine !== false;
    }
}
