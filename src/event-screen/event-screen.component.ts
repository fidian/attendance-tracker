import { component, css, html } from 'fudgel';
import { EventScreenComponent } from './event-screen.controller';

export { EventScreenComponent };

component(
    'event-screen',
    {
        style: css`
            :host {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                max-width: 60em;
                margin: 0 auto;
            }

            /* Fixed: the event name and the menu stay while the list moves. */
            header {
                display: flex;
                align-items: center;
                gap: 0.5em;
                flex: 0 0 auto;
                padding: 0.8em 0.8em 0.6em;
            }

            h1 {
                flex: 1;
                min-width: 0;
                margin: 0;
                font-size: 1.15em;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .back {
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
                width: 2.6em;
                height: 2.6em;
                padding: 0;
                font: inherit;
                color: var(--fg-color);
                background: none;
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
            }

            .back svg {
                width: 1.3em;
                height: 1.3em;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .offline {
                margin: 0 0.8em 0.4em;
                padding: 0.5em 0.8em;
                font-size: 0.9em;
                background-color: var(--notice-bg-color);
                border-radius: 0.5em;
            }

            .count {
                margin: 0 0.8em 0.5em;
                font-size: 0.9em;
                opacity: 0.75;
            }

            .scroll {
                flex: 1;
                overflow-y: auto;
                padding: 0 0.8em calc(1em + env(safe-area-inset-bottom));
            }

            /*
             * Two columns on a phone, more as the screen allows. No media
             * query: auto-fill does it from the minimum tile width.
             */
            ul {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(8.5em, 1fr));
                gap: 0.4em;
                margin: 0;
                padding: 0;
                list-style: none;
            }

            .name {
                display: block;
                width: 100%;
                padding: 0.75em 0.6em;
                font: inherit;
                font-size: 1em;
                text-align: left;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
                /* Keep a fast double tap from zooming the page. */
                touch-action: manipulation;
                transition:
                    color 0.25s ease-out,
                    background-color 0.25s ease-out,
                    border-color 0.25s ease-out;
            }

            /*
             * Present is a state, not an event, so it simply stays lit. The
             * old build flashed and faded because the fade was the only
             * confirmation; here the database says so and the tile agrees.
             */
            .name.present {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
            }

            /* A write still in flight, so a slow network is visible. */
            .name.pending {
                opacity: 0.55;
            }

            .name:disabled {
                cursor: default;
            }

            .empty {
                margin: 2em 0;
                text-align: center;
                opacity: 0.8;
            }

            .error {
                padding: 0.6em 0.8em;
                margin-bottom: 0.9em;
                color: var(--danger-color);
                border: 2px solid var(--danger-color);
                border-radius: 0.5em;
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

            button.action {
                padding: 0.8em 1.1em;
                font: inherit;
                font-size: 1.05em;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
            }

            button.action.primary {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
            }

            button.action.danger {
                color: var(--danger-color);
                border-color: var(--danger-color);
                background: none;
            }

            button.action:disabled {
                opacity: 0.45;
                cursor: default;
            }

            .row {
                display: flex;
                gap: 0.5em;
                margin-bottom: 1em;
            }

            .row button {
                flex: 1;
            }

            .toast {
                position: fixed;
                left: 50%;
                bottom: calc(1em + env(safe-area-inset-bottom));
                transform: translateX(-50%);
                width: max-content;
                max-width: 90vw;
                padding: 0.7em 1.1em;
                text-align: center;
                background-color: var(--notice-bg-color);
                border: var(--control-border);
                border-radius: 0.6em;
                box-shadow: 0 0.2em 1em rgb(0 0 0 / 0.25);
            }

            @media (prefers-reduced-motion: reduce) {
                .name {
                    transition: none;
                }
            }
        `,
        template: html`
            <header>
                <button class="back" @click="back()" aria-label="All events">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M15 5l-7 7 7 7" />
                    </svg>
                </button>
                <h1>{{ title(event) }}</h1>
                <app-menu
                    .items="menuItems()"
                    @menu-select="onMenu($event.detail)"
                ></app-menu>
            </header>

            <p class="offline" *if="!online">
                No connection. Nothing can be marked until it comes back.
            </p>

            <input
                #ref="picker"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                hidden
                @change="onFilePicked($event)"
            />

            <div class="scroll">
                <p class="error" *if="error">{{ error }}</p>

                <div *if="view === 'rename'">
                    <label for="event-rename">Event name</label>
                    <input
                        id="event-rename"
                        type="text"
                        autocomplete="off"
                        .value="renameTo"
                        @input="setRenameTo($event.target.value)"
                        @keydown.enter.prevent="rename()"
                    />
                    <div class="row">
                        <button class="action" @click="cancel()">Cancel</button>
                        <button
                            class="action primary"
                            @click="rename()"
                            .disabled="!renameTo.trim() || busy"
                        >
                            Rename
                        </button>
                    </div>
                </div>

                <div *if="view === 'confirm-delete'">
                    <p>
                        Delete <strong>{{ title(event) }}</strong> and everyone
                        on its roster? Other events are untouched, and this
                        cannot be undone.
                    </p>
                    <div class="row">
                        <button class="action" @click="cancel()">Keep it</button>
                        <button
                            class="action danger"
                            @click="deleteEvent()"
                            .disabled="busy"
                        >
                            Delete
                        </button>
                    </div>
                </div>

                <div *if="view === 'list'">
                    <ul>
                        <li *for="person of people track person.id">
                            <button
                                class="name"
                                #class="{ present: person.present, pending: isPending(person.id, pending) }"
                                .disabled="isBusy(person.id, pending, online)"
                                @click="toggle(person)"
                            >
                                {{ person.display }}
                            </button>
                        </li>
                    </ul>

                    <p class="empty" *if="loaded && !people.length">
                        Nobody on this roster yet. Use the menu to import a
                        sheet or manage people.
                    </p>
                    <p class="empty" *if="!loaded">Loading...</p>
                </div>
            </div>

            <div class="toast" *if="toast" role="status">{{ toast }}</div>
        `,
    },
    EventScreenComponent
);
