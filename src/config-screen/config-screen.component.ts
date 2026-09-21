import { component, css, html } from 'fudgel';
import { ConfigScreenComponent } from './config-screen.controller';

export { ConfigScreenComponent };

component(
    'config-screen',
    {
        style: css`
            :host {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                max-width: 34em;
                margin: 0 auto;
            }

            header {
                display: flex;
                align-items: center;
                gap: 0.5em;
                padding: 0.8em 1em 0.4em;
            }

            h1 {
                flex: 1;
                margin: 0;
                font-size: 1.3em;
            }

            .scroll {
                flex: 1;
                overflow-y: auto;
                padding: 0 1em calc(1em + env(safe-area-inset-bottom));
            }

            p {
                margin: 0 0 0.8em;
            }

            .hint {
                font-size: 0.9em;
                opacity: 0.75;
            }

            label {
                display: block;
                margin-bottom: 0.3em;
                font-weight: bold;
            }

            input {
                width: 100%;
                box-sizing: border-box;
                margin-bottom: 0.9em;
                padding: 0.7em;
                font-size: 1.05em;
                font-family: inherit;
                color: var(--fg-color);
                background-color: var(--bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
            }

            button {
                padding: 0.8em 1.1em;
                font: inherit;
                font-size: 1.05em;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
                touch-action: manipulation;
            }

            button.primary {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
            }

            button.danger {
                color: var(--danger-color);
                border-color: var(--danger-color);
                background: none;
            }

            button:disabled {
                opacity: 0.45;
                cursor: default;
            }

            .row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5em;
                margin-bottom: 1.2em;
            }

            .row button {
                flex: 1 1 8em;
            }

            .error {
                padding: 0.6em 0.8em;
                margin-bottom: 0.9em;
                color: var(--danger-color);
                border: 2px solid var(--danger-color);
                border-radius: 0.5em;
            }

            hr {
                margin: 1.4em 0;
                border: none;
                border-top: var(--control-border);
            }

            .qr {
                max-width: 16em;
                margin: 0 auto 0.8em;
                padding: 0.8em;
                /* A code is read by contrast, so it stays light in both
                   themes rather than inverting with the page. */
                background-color: #ffffff;
                border-radius: 0.5em;
            }

            .qr svg {
                display: block;
                width: 100%;
                height: auto;
            }

            .about {
                margin-top: 1.6em;
                font-size: 0.9em;
                text-align: center;
            }

            a {
                color: var(--link-color);
            }

            .share-url {
                word-break: break-all;
                font-size: 0.85em;
                opacity: 0.75;
            }
        `,
        template: html`
            <header>
                <h1>Settings</h1>
                <button *if="saved" @click="close()">Done</button>
            </header>

            <div class="scroll">
                <p class="error" *if="error">{{ error }}</p>

                <div *if="view === 'edit'">
                    <p *if="!saved">
                        This device has not been set up yet. Paste the Google
                        Form link below, or scan the code from a device that is
                        already set up.
                    </p>

                    <label for="form-url">Google Form link or ID</label>
                    <input
                        id="form-url"
                        type="url"
                        autocomplete="off"
                        placeholder="https://docs.google.com/forms/d/e/.../viewform"
                        .value="formId"
                        @input="setFormUrl($event.target.value)"
                    />
                    <p class="hint">
                        On the form, use the menu and choose "Get pre-filled
                        link", fill in the name box with anything, press "Get
                        link", then copy it here. That address carries the name
                        field too, so the box below fills itself in.
                    </p>

                    <label for="name-entry">Name field</label>
                    <input
                        id="name-entry"
                        type="text"
                        inputmode="numeric"
                        autocomplete="off"
                        placeholder="entry.1234567890"
                        .value="nameEntry"
                        @input="setNameEntry($event.target.value)"
                    />

                    <div class="row">
                        <button
                            class="primary"
                            @click="save()"
                            .disabled="!canSave(formId, nameEntry)"
                        >
                            Save
                        </button>
                    </div>

                    <hr />

                    <div class="row">
                        <button *if="saved" @click="show('share')">
                            Share by QR code
                        </button>
                        <button @click="show('scan')">Scan a QR code</button>
                    </div>

                    <div class="row" *if="!confirming">
                        <button class="danger" @click="confirmClear()">
                            Clear all info
                        </button>
                    </div>

                    <div *if="confirming">
                        <p>
                            This forgets the form settings and every name on
                            this device. Entries already sent are not touched.
                        </p>
                        <div class="row">
                            <button @click="cancelClear()">Keep it</button>
                            <button class="danger" @click="clearAll()">
                                Clear everything
                            </button>
                        </div>
                    </div>

                    <p class="about">
                        <!-- Opens away from the app: an installed PWA has no
                             back button to return with. -->
                        <a
                            href="{{ projectUrl }}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >Full instructions and source</a
                        >
                    </p>
                </div>

                <div *if="view === 'share'">
                    <p>
                        Point another device's camera at this code. It opens the
                        app already set up.
                    </p>
                    <qr-code class="qr" content="{{ shareLink }}"></qr-code>
                    <p class="share-url">{{ shareLink }}</p>

                    <div class="row">
                        <button @click="show('edit')">Back</button>
                    </div>
                </div>

                <div *if="view === 'scan'">
                    <qr-scanner
                        @scan="acceptScan($event.detail)"
                        @cancel="show('edit')"
                    ></qr-scanner>
                </div>
            </div>
        `,
    },
    ConfigScreenComponent
);
