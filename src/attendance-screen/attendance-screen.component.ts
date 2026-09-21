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

            .settings {
                display: flex;
                align-items: center;
                justify-content: center;
                font: inherit;
                flex: 0 0 2.4em;
                height: 2.4em;
                padding: 0;
                color: var(--fg-color);
                background: none;
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
                touch-action: manipulation;
            }

            .settings svg {
                width: 1.3em;
                height: 1.3em;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .offline {
                margin: 0 1em 0.4em;
                padding: 0.5em 0.8em;
                font-size: 0.9em;
                background-color: var(--notice-bg-color);
                border-radius: 0.5em;
            }

            .top {
                padding: 0 1em 0.8em;
            }

            .scroll {
                flex: 1;
                overflow-y: auto;
                padding: 0 1em calc(1em + env(safe-area-inset-bottom));
                -webkit-overflow-scrolling: touch;
            }

            ul {
                margin: 0;
                padding: 0;
                list-style: none;
            }

            li {
                display: flex;
                gap: 0.5em;
                margin-bottom: 0.5em;
            }

            .name:disabled {
                opacity: 0.5;
                cursor: default;
            }

            .name {
                flex: 1;
                min-width: 0;
                padding: 0.9em 1em;
                font: inherit;
                font-size: 1.25em;
                text-align: left;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.6em;
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
             * Lit the instant the name is tapped, and released when the entry
             * lands. Going in has no transition so the feedback is immediate;
             * coming out inherits the one above, which is the fade.
             */
            .name.marking {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
                transition: none;
            }

            @media (prefers-reduced-motion: reduce) {
                .name {
                    transition: none;
                }
            }

            .remove {
                display: flex;
                align-items: center;
                justify-content: center;
                /* A button does not inherit the page font, and without that
                   the em below resolves against the UA's smaller default. */
                font: inherit;
                flex: 0 0 3em;
                padding: 0;
                color: var(--danger-color);
                background: none;
                border: var(--control-border);
                border-radius: 0.6em;
                cursor: pointer;
                touch-action: manipulation;
            }

            .remove:hover,
            .remove:focus-visible {
                border-color: var(--danger-color);
            }

            .remove svg {
                width: 1.4em;
                height: 1.4em;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
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
        `,
        template: html`
            <header>
                <h1>Attendance</h1>
                <button
                    class="settings"
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
                <new-name-form
                    .disabled="!online"
                    @name-add="addName($event.detail)"
                ></new-name-form>
            </div>

            <div class="scroll" #ref="list">
                <ul>
                    <li *for="name of names track name">
                        <button
                            class="name"
                            data-name="{{ name }}"
                            #class="{ marking: isMarking(name, marking) }"
                            .disabled="isBusy(name, marking, online)"
                            @click="mark(name)"
                        >
                            {{ name }}
                        </button>
                        <button
                            class="remove"
                            @click="remove(name)"
                            aria-label="Remove {{ name }}"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                    d="M9 3h6M4 6h16M7 6l1 14h8l1-14M10 10v6M14 10v6"
                                />
                            </svg>
                        </button>
                    </li>
                </ul>

                <p class="empty" *if="!names.length">
                    No names yet. Type one above.
                </p>
            </div>

            <div class="toast" *if="toast" role="status">{{ toast }}</div>
        `,
    },
    AttendanceScreenComponent
);
