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

            .intro {
                padding: 0.8em 1em;
                margin-bottom: 1.2em;
                background-color: var(--button-bg-color);
                border-radius: 0.6em;
            }

            .intro p:last-child {
                margin-bottom: 0;
            }

            .intro .lead {
                margin-bottom: 0.3em;
            }

            .intro ol {
                margin: 0 0 0.8em;
                padding-left: 1.3em;
            }

            .intro li {
                margin-bottom: 0.5em;
            }

            .notice {
                padding: 0.6em 0.8em;
                margin-bottom: 0.9em;
                background-color: var(--notice-bg-color);
                border-radius: 0.5em;
            }

            .fields {
                padding: 0.6em 0.8em;
                margin-bottom: 0.9em;
                background-color: var(--button-bg-color);
                border-radius: 0.5em;
            }

            .found {
                margin: 0 0 0.4em;
                font-weight: bold;
            }

            .fields ol {
                margin: 0;
                padding-left: 1.3em;
            }

            .fields li {
                margin-bottom: 0.2em;
            }

            .entry {
                font-size: 0.8em;
                opacity: 0.6;
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
                <p class="notice" *if="notice">{{ notice }}</p>

                <div *if="view === 'edit'">
                    <div class="intro" *if="!saved">
                        <p>
                            This app takes attendance. Everyone on the roster
                            gets a tile; tapping one posts that person to a
                            Google Form, which collects the entries in a
                            spreadsheet along with the time. One tap, nothing
                            to confirm.
                        </p>

                        <p class="lead">
                            <strong>Someone else already set up a device?</strong>
                            Tap <em>Scan a QR code</em> at the bottom of this
                            screen and point it at theirs. That is the whole
                            job -- the form, its questions and the roster all
                            come across.
                        </p>

                        <p class="lead"><strong>Setting up the first one?</strong></p>
                        <ol>
                            <li>
                                Make a Google Form with one
                                <strong>short answer</strong> question for each
                                thing you want recorded -- a name, maybe a
                                troop or a den.
                                <a
                                    href="{{ docs.form }}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >How to make the form</a
                                >
                            </li>
                            <li>
                                On that form choose
                                <em>Get pre-filled link</em>, and type each
                                question's own name into its box -- "First"
                                into the first-name box. Press
                                <em>Get link</em> and copy it.
                            </li>
                            <li>
                                Paste it below and press <em>Save</em>. The app
                                reads the questions straight out of that
                                address.
                            </li>
                        </ol>

                        <p>
                            Optional: keep the roster in a published
                            spreadsheet instead of typing people in.
                            <a
                                href="{{ docs.roster }}"
                                target="_blank"
                                rel="noopener noreferrer"
                                >How the roster sheet works</a
                            >
                        </p>

                        <p>
                            <a
                                href="{{ docs.setup }}"
                                target="_blank"
                                rel="noopener noreferrer"
                                >Full setup guide</a
                            >
                        </p>
                    </div>

                    <label for="form-url">Pre-filled Google Form link</label>
                    <input
                        id="form-url"
                        type="url"
                        autocomplete="off"
                        placeholder="https://docs.google.com/forms/d/e/.../viewform?usp=pp_url&entry..."
                        .value="formId"
                        @input="setFormUrl($event.target.value)"
                    />
                    <p class="hint">
                        On the form, open the menu and choose "Get pre-filled
                        link". Type each question's <em>name</em> into its own
                        box -- "First" into the first-name box, "Troop" into
                        the troop box -- then press "Get link" and copy it. The
                        address carries the questions and their names together,
                        which is how this app learns them. Every question has
                        to be a short answer.
                    </p>

                    <div class="fields" *if="fields.length">
                        <p class="found">{{ fieldSummary(fields) }}</p>
                        <ol>
                            <li *for="field of fields track field.id">
                                {{ field.label }}
                                <span class="entry">entry.{{ field.id }}</span>
                            </li>
                        </ol>
                    </div>

                    <label for="csv-url">Roster sheet (optional)</label>
                    <input
                        id="csv-url"
                        type="url"
                        autocomplete="off"
                        placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                        .value="csvUrl"
                        @input="setCsvUrl($event.target.value)"
                    />
                    <p class="hint">
                        In the sheet, use File, Share, "Publish to web", pick
                        the tab and <em>Comma-separated values</em>. The first
                        column is what this app shows; every other column fills
                        the question whose name matches its heading.
                    </p>

                    <div class="row">
                        <button
                            @click="importCsv()"
                            .disabled="!csvUrl || busy"
                        >
                            {{ busy ? 'Importing...' : 'Import roster now' }}
                        </button>
                    </div>

                    <div class="row">
                        <button
                            class="primary"
                            @click="save()"
                            .disabled="!canSave(formId, fields)"
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
                            This forgets the form settings and everyone on this
                            device. Entries already sent are not touched.
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
