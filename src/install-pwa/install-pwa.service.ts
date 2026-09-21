interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
}

/**
 * Chromium fires `beforeinstallprompt` and lets the page show the install
 * prompt later. Other browsers never fire it, so the banner simply never
 * appears there.
 */
export class InstallPwaService {
    private _event: BeforeInstallPromptEvent | null = null;

    listenForEvents() {
        addEventListener('beforeinstallprompt', event => {
            event.preventDefault();
            this._event = event as BeforeInstallPromptEvent;
            document.body.appendChild(document.createElement('install-pwa'));
        });

        addEventListener('appinstalled', () => {
            this._event = null;
        });
    }

    triggerSavedEvent() {
        const event = this._event;
        this._event = null;
        event?.prompt();
    }
}
