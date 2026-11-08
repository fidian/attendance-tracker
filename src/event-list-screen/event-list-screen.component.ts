import { component, css, html } from 'fudgel';
import { EventListScreenComponent } from './event-list-screen.controller';

export { EventListScreenComponent };

component(
    'event-list-screen',
    {
        style: css`
            :host {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                max-width: 44em;
                margin: 0 auto;
            }

            /* Fixed: the title and the menu stay put while the list moves. */
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
                font-size: 1.3em;
            }

            .scroll {
                flex: 1;
                overflow-y: auto;
                padding: 0 0.8em calc(1em + env(safe-area-inset-bottom));
            }

            ul {
                margin: 0;
                padding: 0;
                list-style: none;
            }

            li {
                margin-bottom: 0.5em;
            }

            .event {
                display: block;
                width: 100%;
                padding: 0.9em 1em;
                font: inherit;
                font-size: 1.1em;
                text-align: left;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.6em;
                cursor: pointer;
                touch-action: manipulation;
            }

            .empty {
                margin: 2em 0 1em;
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

            input,
            select {
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

            button:disabled {
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
        `,
        template: html`
            <header>
                <h1>Event Selection</h1>
                <app-menu
                    .items="menuItems(events)"
                    @menu-select="onMenu($event.detail)"
                ></app-menu>
            </header>

            <input
                #ref="picker"
                type="file"
                accept=".json,application/json"
                hidden
                @change="onFilePicked($event)"
            />

            <div class="scroll">
                <p class="error" *if="error">{{ error }}</p>

                <div *if="view === 'new'">
                    <label for="event-name">Event name</label>
                    <input
                        id="event-name"
                        type="text"
                        autocomplete="off"
                        .value="newName"
                        @input="setNewName($event.target.value)"
                        @keydown.enter.prevent="createEvent()"
                    />

                    <label for="event-source">People</label>
                    <select
                        id="event-source"
                        .value="newSource"
                        @change="setNewSource($event.target.value)"
                    >
                        <option value="">Start with nobody</option>
                        <option
                            *for="event of events track event.id"
                            value="{{ event.id }}"
                        >
                            Copy from {{ event.name }}
                        </option>
                    </select>

                    <div class="row">
                        <button @click="cancelNew()">Cancel</button>
                        <button
                            class="primary"
                            @click="createEvent()"
                            .disabled="!newName.trim() || busy"
                        >
                            {{ busy ? 'Creating...' : 'Create' }}
                        </button>
                    </div>
                </div>

                <div *if="view === 'list'">
                    <ul>
                        <li *for="event of events track event.id">
                            <button class="event" @click="open(event.id)">
                                {{ event.name }}
                            </button>
                        </li>
                    </ul>

                    <div *if="canSeed(loaded, events, busy)">
                        <p class="empty">
                            Nothing here yet. Make an event from the menu, or
                            start with a sample so there is something to look
                            at.
                        </p>
                        <div class="row">
                            <button class="primary" @click="seed()">
                                Add a sample event and roster
                            </button>
                        </div>
                    </div>

                    <p class="empty" *if="!loaded">Loading...</p>
                </div>
            </div>

            <div class="toast" *if="toast" role="status">{{ toast }}</div>
        `,
    },
    EventListScreenComponent
);
