import { describe, expect, it } from 'vitest';
import { EventScreenComponent } from './event-screen.controller';

/**
 * The menu is the only way to reach most of this screen, and an item with no
 * handler looks exactly like a working one until somebody taps it. `Export
 * roster (Excel)` shipped that way: the method existed and was tested, but no
 * menu entry called it, so the feature was unreachable.
 *
 * Nothing here touches a database -- it only asks what the screen offers and
 * what it knows how to do.
 */
describe('the event menu', () => {
    const screen = Object.create(
        EventScreenComponent.prototype
    ) as EventScreenComponent;

    it('has a handler for every item it offers', () => {
        const offered = screen.menuItems().map(item => item.id);
        const handled = Object.keys(screen.menuActions());

        expect(offered.length).toBeGreaterThan(0);
        expect(offered.filter(id => !handled.includes(id))).toEqual([]);
    });

    it('offers every action it can perform', () => {
        const offered = screen.menuItems().map(item => item.id);
        const handled = Object.keys(screen.menuActions());

        expect(handled.filter(id => !offered.includes(id))).toEqual([]);
    });

    it('offers both formats for the roster and the report', () => {
        const labels = screen.menuItems().map(item => item.label);

        expect(labels).toContain('Export roster (CSV)');
        expect(labels).toContain('Export roster (Excel)');
        expect(labels).toContain('Export report (CSV)');
        expect(labels).toContain('Export report (Excel)');
    });

    it('marks only deleting as destructive', () => {
        expect(
            screen.menuItems().filter(item => item.danger).map(item => item.id)
        ).toEqual(['delete']);
    });

    it('ignores an id it does not know', () => {
        expect(() => screen.onMenu('nonsense')).not.toThrow();
    });
});
