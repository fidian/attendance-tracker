import { component, css, html } from 'fudgel';
import { AttendanceScreenComponent } from './attendance-screen.controller';

export { AttendanceScreenComponent };

component(
    'attendance-screen',
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

            header {
                display: flex;
                align-items: center;
                gap: 0.5em;
                padding: 0.8em 0.8em 0.4em;
            }

            h1 {
                flex: 1;
                margin: 0;
                font-size: 1.3em;
            }

            .icon {
                display: flex;
                align-items: center;
                justify-content: center;
                font: inherit;
                flex: 0 0 2.6em;
                height: 2.6em;
                padding: 0;
                color: var(--fg-color);
                background: none;
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
                touch-action: manipulation;
            }

            .icon.on {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
            }

            .icon svg {
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

            .top {
                display: flex;
                gap: 0.5em;
                padding: 0 0.8em 0.6em;
            }

            .filter {
                flex: 1;
                min-width: 0;
                padding: 0.7em;
                font-size: 1.05em;
                font-family: inherit;
                color: var(--fg-color);
                background-color: var(--bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
            }

            .scroll {
                flex: 1;
                overflow-y: auto;
                padding: 0 0.8em calc(1em + env(safe-area-inset-bottom));
                -webkit-overflow-scrolling: touch;
            }

            /*
             * Two columns on a phone, more as the screen allows. At 375px
             * this shows 26 people at once where one wide column showed 10.
             */
            ul {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(8.5em, 1fr));
                gap: 0.4em;
                margin: 0;
                padding: 0;
                list-style: none;
            }

            li {
                position: relative;
                display: flex;
            }

            .name {
                flex: 1;
                min-width: 0;
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
                /* Only the way back is animated. See .marking below. */
                transition:
                    color 0.7s ease-out,
                    background-color 0.7s ease-out,
                    border-color 0.7s ease-out;
            }

            /*
             * Lit the instant someone is tapped, and released when the entry
             * lands. Going in has no transition so the feedback is immediate;
             * coming out inherits the one above, which is the fade.
             */
            .name.marking {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
                transition: none;
            }

            .name:disabled {
                opacity: 0.55;
                cursor: default;
            }

            li.editing .name {
                opacity: 1;
                border-style: dashed;
            }

            .remove {
                position: absolute;
                top: -0.4em;
                right: -0.3em;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 1.9em;
                height: 1.9em;
                padding: 0;
                font: inherit;
                color: var(--accent-fg-color);
                background-color: var(--danger-color);
                border: none;
                border-radius: 50%;
                cursor: pointer;
                touch-action: manipulation;
            }

            .remove svg {
                width: 1em;
                height: 1em;
                fill: none;
                stroke: currentColor;
                stroke-width: 3;
                stroke-linecap: round;
            }

            .empty {
                margin: 2em 0;
                text-align: center;
                opacity: 0.7;
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
                <h1>Attendance</h1>
                <button
                    class="icon"
                    @click="openSettings()"
                    aria-label="Settings"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-8l-3.7 3.9z"
                        />
                    </svg>
                </button>
            </header>

            <p class="offline" *if="!online">
                No connection. Entries cannot be sent right now, so the names
                are disabled until it comes back.
            </p>

            <div class="top">
                <input
                    class="filter"
                    type="text"
                    autocomplete="off"
                    enterkeyhint="search"
                    placeholder="Filter names"
                    .value="filter"
                    .disabled="adding"
                    @input="setFilter($event.target.value)"
                />
                <button
                    class="icon"
                    @click="startAdding()"
                    .disabled="adding"
                    aria-label="Add someone"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
                <button
                    class="icon"
                    #class="{ on: editing }"
                    @click="toggleEditing()"
                    aria-label="{{ editing ? 'Done editing' : 'Edit the roster' }}"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"
                        />
                    </svg>
                </button>
            </div>

            <div class="scroll" #ref="list">
                <person-form
                    *if="adding"
                    .fields="fields"
                    @person-add="addPerson($event.detail)"
                    @cancel="stopAdding()"
                ></person-form>

                <ul>
                    <li
                        *for="person of shown track person.label"
                        #class="{ editing: editing }"
                    >
                        <button
                            class="name"
                            data-name="{{ person.label }}"
                            #class="{ marking: isMarking(person.label, marking) }"
                            .disabled="isBusy(person.label, marking, online, editing)"
                            @click="mark(person.label)"
                        >
                            {{ person.label }}
                        </button>
                        <button
                            class="remove"
                            *if="editing"
                            @click="remove(person.label)"
                            aria-label="Remove {{ person.label }}"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    </li>
                </ul>

                <p class="empty" *if="!shown.length && !adding">
                    {{ filter ? 'Nobody matches that.' : 'Nobody here yet. Use + to add someone, or import a sheet in settings.' }}
                </p>
            </div>

            <div class="toast" *if="toast" role="status">{{ toast }}</div>
        `,
    },
    AttendanceScreenComponent
);
