import { component, css, html } from 'fudgel';
import { SetupScreenComponent } from './setup-screen.controller';

export { SetupScreenComponent };

component(
    'setup-screen',
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

            .intro {
                padding: 0.8em 1em;
                margin-bottom: 1.2em;
                background-color: var(--button-bg-color);
                border-radius: 0.6em;
            }

            .intro p:last-child {
                margin-bottom: 0;
            }

            .intro ol {
                margin: 0 0 0.8em;
                padding-left: 1.3em;
            }

            .intro li {
                margin-bottom: 0.5em;
            }

            label {
                display: block;
                margin-bottom: 0.3em;
                font-weight: bold;
            }

            input {
                width: 100%;
                box-sizing: border-box;
                margin-bottom: 0.4em;
                padding: 0.7em;
                font-size: 1.05em;
                font-family: inherit;
                color: var(--fg-color);
                background-color: var(--bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
            }

            .hint {
                font-size: 0.9em;
                opacity: 0.75;
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

            .warn {
                padding: 0.6em 0.8em;
                margin-bottom: 0.9em;
                background-color: var(--notice-bg-color);
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

            a {
                color: var(--link-color);
            }

            .about {
                margin-top: 1.6em;
                font-size: 0.9em;
                text-align: center;
            }
        `,
        template: html`
            <header>
                <h1>Setup</h1>
                <button *if="saved" @click="close()">Done</button>
            </header>

            <div class="scroll">
                <p class="error" *if="error">{{ error }}</p>

                <div *if="view === 'edit'">
                    <div class="intro" *if="!saved">
                        <p>
                            This app takes attendance. You pick an event, and
                            tapping somebody marks them present — on every
                            phone looking at that event, straight away. Tap
                            again to unmark.
                        </p>

                        <p>
                            <strong>Somebody already set up a phone?</strong>
                            Choose <em>Scan a code</em> below and point it at
                            theirs. That is the whole job.
                        </p>

                        <p><strong>Setting up the first one?</strong></p>
                        <ol>
                            <li>
                                Make a free Firebase project with a
                                <strong>Realtime Database</strong>.
                                <a
                                    href="{{ docs.firebase }}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >Step by step</a
                                >
                            </li>
                            <li>
                                Publish the security rules from the
                                instructions. Without them the database
                                refuses everything.
                            </li>
                            <li>
                                Copy the address from the database's
                                <em>Data</em> tab and paste it below.
                            </li>
                        </ol>
                    </div>

                    <label for="db-url">Database address</label>
                    <input
                        id="db-url"
                        type="url"
                        autocomplete="off"
                        spellcheck="false"
                        placeholder="https://your-project-default-rtdb.firebaseio.com"
                        .value="databaseUrl"
                        @input="setDatabaseUrl($event.target.value)"
                    />
                    <p class="hint">
                        Nothing else is needed, and nothing about your database
                        is built into this app — the address lives only on the
                        devices you put it on.
                    </p>

                    <div class="row">
                        <button
                            class="primary"
                            @click="save()"
                            .disabled="!canSave(databaseUrl)"
                        >
                            Save
                        </button>
                    </div>

                    <hr />

                    <div class="row">
                        <button *if="saved" @click="show('share')">
                            Share with another phone
                        </button>
                        <button @click="show('scan')">Scan a code</button>
                    </div>

                    <div class="row" *if="saved">
                        <button class="danger" @click="clearAll()">
                            Forget this device's settings
                        </button>
                    </div>

                    <p class="about">
                        <a
                            href="{{ projectUrl }}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >Full instructions and source</a
                        >
                    </p>
                </div>

                <div *if="view === 'share'">
                    <p class="warn">
                        <strong>Treat this like a door key.</strong> Anybody
                        who photographs it can read, change and delete
                        everything — it carries the database address and your
                        group. There is no way to take access back afterwards.
                        <a
                            href="{{ docs.security }}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >What this means</a
                        >
                    </p>

                    <p>
                        Point the other phone's camera at this, or use
                        <em>Scan a code</em> in the app there.
                    </p>
                    <qr-code class="qr" content="{{ shareLink }}"></qr-code>

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
    SetupScreenComponent
);
