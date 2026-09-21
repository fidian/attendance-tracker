import { component, css, emit, html } from 'fudgel';

export class NewNameFormComponent {
    disabled = false;
    name = '';

    canAdd(name: string, disabled: boolean) {
        return !disabled && !!name.trim();
    }

    setName(value: string) {
        this.name = value;
    }

    add() {
        const name = this.name.trim();

        if (name && !this.disabled) {
            emit(this, 'nameAdd', name);
            this.name = '';
        }
    }
}

component(
    'new-name-form',
    {
        prop: ['disabled'],
        style: css`
            :host {
                display: block;
            }

            form {
                display: flex;
                gap: 0.5em;
            }

            input:disabled {
                opacity: 0.5;
            }

            input {
                flex: 1;
                min-width: 0;
                padding: 0.7em;
                font-size: 1.1em;
                font-family: inherit;
                color: var(--fg-color);
                background-color: var(--bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
            }

            button {
                display: flex;
                align-items: center;
                justify-content: center;
                font: inherit;
                /* Matches the trash can beside it, so the two columns line
                   up down the screen. */
                flex: 0 0 3em;
                padding: 0;
                color: var(--accent-color);
                background: none;
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
                touch-action: manipulation;
            }

            button:hover:not(:disabled),
            button:focus-visible {
                border-color: var(--accent-color);
            }

            button:disabled {
                color: var(--fg-color);
                opacity: 0.35;
                cursor: default;
            }

            svg {
                width: 2em;
                height: 2em;
                fill: none;
                stroke: currentColor;
                stroke-width: 3;
                stroke-linecap: round;
                stroke-linejoin: round;
            }
        `,
        template: html`
            <form @submit.prevent="add()">
                <input
                    type="text"
                    placeholder="New Name"
                    autocomplete="off"
                    autocapitalize="words"
                    enterkeyhint="done"
                    .value="name"
                    .disabled="disabled"
                    @input="setName($event.target.value)"
                    @keydown.enter.prevent="add()"
                />
                <button
                    type="submit"
                    .disabled="!canAdd(name, disabled)"
                    aria-label="Add this name and mark them here"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 12.5 L9.5 18.5 L20 6" />
                    </svg>
                </button>
            </form>
        `,
    },
    NewNameFormComponent
);
