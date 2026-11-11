import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../services/config.service';
import { diOverride } from '../di';
import { SetupScreenComponent } from './setup-screen.controller';
import { storage } from '../services/local-storage.service';

/**
 * `navigator.clipboard` is a browser API rather than one of this app's
 * services, so standing in for it hides nothing: what is being checked is
 * what this screen does when the copy works and when it does not.
 */
const screen = () =>
    Object.create(SetupScreenComponent.prototype) as SetupScreenComponent;

const CONNECTION = {
    databaseUrl: 'https://attendance-sample-default-rtdb.firebaseio.com',
    groupId: 'M5wzfssFBd3AYKAEVCdqiX',
};

describe('copying the setup link', () => {
    let written: string[];

    beforeEach(() => {
        vi.useFakeTimers();
        written = [];
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    const withClipboard = (writeText: (text: string) => Promise<void>) =>
        vi.stubGlobal('navigator', { clipboard: { writeText } });

    it('copies the same link the code carries', async () => {
        withClipboard(async text => {
            written.push(text);
        });

        const setup = screen();
        setup.shareLink = 'https://example.test/app/#db=x&g=y';
        await setup.copyLink();

        expect(written).toEqual(['https://example.test/app/#db=x&g=y']);
        expect(setup.note).toBe('Link copied.');
    });

    it('forgets it said so after a moment', async () => {
        withClipboard(async () => {});

        const setup = screen();
        setup.shareLink = 'https://example.test/app/#db=x&g=y';
        await setup.copyLink();
        vi.advanceTimersByTime(5000);

        expect(setup.note).toBe('');
    });

    /** No permission, an insecure context, or a browser without the API. */
    it('selects the link instead when the clipboard refuses', async () => {
        withClipboard(async () => {
            throw new Error('denied');
        });

        let selected = false;
        const setup = screen();
        setup.shareLink = 'https://example.test/app/#db=x&g=y';
        setup.linkBox = {
            select: () => {
                selected = true;
            },
        } as unknown as HTMLInputElement;
        await setup.copyLink();

        expect(selected, 'the link has to end up selectable by hand').toBe(
            true
        );
        expect(setup.note).toMatch(/copy/i);
    });

    it('survives a browser with no clipboard at all', async () => {
        vi.stubGlobal('navigator', {});

        const setup = screen();
        setup.shareLink = 'https://example.test/app/#db=x&g=y';

        await expect(setup.copyLink()).resolves.toBeUndefined();
        expect(setup.note).toMatch(/copy/i);
    });

    it('does nothing without a link', async () => {
        withClipboard(async text => {
            written.push(text);
        });

        const setup = screen();
        setup.shareLink = '';
        await setup.copyLink();

        expect(written).toEqual([]);
        expect(setup.note).toBeUndefined();
    });
});

describe('the share view', () => {
    beforeEach(() => {
        storage.clear();
        // `shareUrl` builds on wherever the app is served from.
        vi.stubGlobal('location', { href: 'https://example.test/app/' });
        const config = new ConfigService();
        config.set(CONNECTION);
        diOverride(ConfigService, config);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fills the box with a link carrying both halves', () => {
        const setup = new SetupScreenComponent();
        setup.show('share');

        expect(setup.shareLink).toContain('db=');
        expect(setup.shareLink).toContain(`g=${CONNECTION.groupId}`);
    });

    it('empties it again on the way out', () => {
        const setup = new SetupScreenComponent();
        setup.show('share');
        setup.show('edit');

        expect(setup.shareLink, 'the key should not linger off-screen').toBe(
            ''
        );
    });
});
