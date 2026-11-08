import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from './config.service';
import { diOverride } from '../di';
import { FirebaseService, type ChildHandlers } from './firebase.service';
import { RosterService, type Person } from './roster.service';
import { storage } from './local-storage.service';

/**
 * A recorder stands in for `FirebaseService` -- the one service that reaches
 * out, and so the one it is fair to fake. What is being checked is the wiring
 * around it: which callbacks get attached and what each one does. A real
 * database cannot be asked "and what if nothing ever happens?", which is
 * exactly the case that broke.
 *
 * The bug this guards shipped: an event with nobody on it fires no child
 * events, so the roster listener was never called and the screen said
 * "Loading..." forever.
 */
class RecordingFirebase {
    handlers: ChildHandlers | null = null;
    path = '';
    unwatched = false;

    watchChildren(path: string, handlers: ChildHandlers) {
        this.path = path;
        this.handlers = handlers;

        return () => {
            this.unwatched = true;
        };
    }
}

const CONNECTION = {
    databaseUrl: 'https://attendance-sample-default-rtdb.firebaseio.com',
    groupId: 'M5wzfssFBd3AYKAEVCdqiX',
};

describe('RosterService.watch', () => {
    let firebase: RecordingFirebase;
    let roster: RosterService;
    let seen: Person[][];

    beforeEach(() => {
        storage.clear();
        const config = new ConfigService();
        config.set(CONNECTION);
        diOverride(ConfigService, config);
        firebase = new RecordingFirebase();
        diOverride(FirebaseService, firebase as unknown as FirebaseService);
        roster = new RosterService();
        seen = [];
    });

    const start = (eventId = 'e1') => roster.watch(eventId, p => seen.push(p));

    const latest = () => seen[seen.length - 1];

    it('watches the roster for that event under this group', () => {
        start();

        expect(firebase.path).toBe(`groups/${CONNECTION.groupId}/roster/e1`);
    });

    /** The bug. */
    it('reports an empty roster once the initial load lands', () => {
        start();
        expect(seen, 'nothing should be emitted before the load completes')
            .toEqual([]);

        firebase.handlers!.ready();

        expect(seen).toEqual([[]]);
    });

    it('reports people that arrive before the load completes', () => {
        start();
        firebase.handlers!.added('p1', { display: 'Zoe' });
        firebase.handlers!.added('p2', { display: 'Ada' });
        firebase.handlers!.ready();

        expect(latest().map(person => person.display)).toEqual(['Ada', 'Zoe']);
    });

    it('keeps reporting changes afterwards', () => {
        start();
        firebase.handlers!.ready();
        firebase.handlers!.added('p1', { display: 'Ada', present: false });
        firebase.handlers!.changed('p1', { display: 'Ada', present: true });

        expect(latest()[0].present).toBe(true);

        firebase.handlers!.removed('p1');
        expect(latest()).toEqual([]);
    });

    it('stops watching when told to', () => {
        start()();

        expect(firebase.unwatched).toBe(true);
    });
});
