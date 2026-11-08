export type Screen = 'events' | 'event' | 'people';

export interface Route {
    screen: Screen;
    eventId: string;
}

export type NavigationListener = (route: Route) => void;

const EVENT_KEY = 'event';
const PEOPLE_KEY = 'people';

/**
 * Where you are lives in the query string rather than the fragment, for two
 * reasons. The fragment is reserved for the connection a shared QR code
 * carries, and GitHub Pages serves `?event=x` from the app itself while a
 * path segment would hit the 404 page.
 */
export const readRoute = (search: string): Route => {
    const params = new URLSearchParams(search || '');
    const eventId = (params.get(EVENT_KEY) || '').trim();

    if (!eventId) {
        return { screen: 'events', eventId: '' };
    }

    return {
        screen: params.get(PEOPLE_KEY) ? 'people' : 'event',
        eventId,
    };
};

export const writeRoute = (route: Route): string => {
    if (route.screen === 'events' || !route.eventId) {
        return '';
    }

    const params = new URLSearchParams({ [EVENT_KEY]: route.eventId });

    if (route.screen === 'people') {
        params.set(PEOPLE_KEY, '1');
    }

    return `?${params}`;
};

export const sameRoute = (a: Route, b: Route) =>
    a.screen === b.screen && a.eventId === b.eventId;

export class NavigationService {
    private _listeners = new Set<NavigationListener>();
    private _route: Route = { screen: 'events', eventId: '' };

    listenForEvents() {
        this._route = readRoute(location.search);
        // The phone back button walks from an event back to the list.
        addEventListener('popstate', () => {
            this._route = readRoute(location.search);
            this._notify();
        });
    }

    current(): Route {
        return this._route;
    }

    go(screen: Screen, eventId = '') {
        const route: Route = { screen, eventId };

        if (sameRoute(route, this._route)) {
            return;
        }

        this._route = route;
        history.pushState(null, '', `${location.pathname}${writeRoute(route)}`);
        this._notify();
    }

    /** Used when an event disappears underneath the screen showing it. */
    replace(screen: Screen, eventId = '') {
        this._route = { screen, eventId };
        history.replaceState(
            null,
            '',
            `${location.pathname}${writeRoute(this._route)}`
        );
        this._notify();
    }

    subscribe(listener: NavigationListener): () => void {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    private _notify() {
        for (const listener of this._listeners) {
            listener(this._route);
        }
    }
}
