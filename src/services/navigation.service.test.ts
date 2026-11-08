import { describe, expect, it } from 'vitest';
import { readRoute, sameRoute, writeRoute } from './navigation.service';

describe('readRoute', () => {
    it('is the event list when nothing is asked for', () => {
        for (const search of ['', '?', '?other=1']) {
            expect(readRoute(search)).toEqual({ screen: 'events', eventId: '' });
        }
    });

    it('opens an event', () => {
        expect(readRoute('?event=abc')).toEqual({
            screen: 'event',
            eventId: 'abc',
        });
    });

    it('opens the people screen for an event', () => {
        expect(readRoute('?event=abc&people=1')).toEqual({
            screen: 'people',
            eventId: 'abc',
        });
    });

    it('falls back to the list when the event id is blank', () => {
        expect(readRoute('?event=&people=1').screen).toBe('events');
    });

    it('survives a leading question mark either way', () => {
        expect(readRoute('event=abc').eventId).toBe('abc');
    });
});

describe('writeRoute', () => {
    it('writes nothing for the list, so the plain URL is the home screen', () => {
        expect(writeRoute({ screen: 'events', eventId: '' })).toBe('');
        expect(writeRoute({ screen: 'events', eventId: 'abc' })).toBe('');
    });

    it('round trips an event and the people screen', () => {
        for (const route of [
            { screen: 'event' as const, eventId: 'abc' },
            { screen: 'people' as const, eventId: 'abc' },
        ]) {
            expect(readRoute(writeRoute(route))).toEqual(route);
        }
    });

    it('escapes an id that needs it', () => {
        const route = { screen: 'event' as const, eventId: 'a b&c' };

        expect(readRoute(writeRoute(route))).toEqual(route);
    });

    /** The fragment belongs to the shared connection and must stay clear. */
    it('never writes a fragment', () => {
        expect(writeRoute({ screen: 'people', eventId: 'abc' })).not.toContain('#');
    });
});

describe('sameRoute', () => {
    it('compares screen and event', () => {
        expect(sameRoute({ screen: 'event', eventId: 'a' }, { screen: 'event', eventId: 'a' })).toBe(true);
        expect(sameRoute({ screen: 'event', eventId: 'a' }, { screen: 'people', eventId: 'a' })).toBe(false);
        expect(sameRoute({ screen: 'event', eventId: 'a' }, { screen: 'event', eventId: 'b' })).toBe(false);
    });
});
