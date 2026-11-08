import { describe, expect, it } from 'vitest';
import { plural } from './text';

describe('plural', () => {
    it('uses the singular for exactly one', () => {
        expect(plural(1, 'event')).toBe('1 event');
    });

    it('adds an s by default', () => {
        expect(plural(0, 'event')).toBe('0 events');
        expect(plural(2, 'event')).toBe('2 events');
    });

    it('takes an irregular plural', () => {
        expect(plural(1, 'person', 'people')).toBe('1 person');
        expect(plural(3, 'person', 'people')).toBe('3 people');
    });
});
