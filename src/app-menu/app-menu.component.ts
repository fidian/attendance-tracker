import { component, css, emit, html } from 'fudgel';

export interface MenuItem {
    id: string;
    label: string;
    /** Shown but unselectable, with a reason the screen decides. */
    disabled?: boolean;
    /** Styled as destructive. */
    danger?: boolean;
}

/**
 * The icon and the popup every screen's header uses. Items come in as a
 * property so each screen supplies its own, some of them disabled; the only
 * thing this knows is how to show them and how to get out of the way.
 */
export class AppMenuComponent {
    items: MenuItem[] = [];
    open = false;

    toggle() {
        this.open = !this.open;
    }

    close() {
        this.open = false;
    }

    choose(item: MenuItem) {
        if (item.disabled) {
            return;
        }

        this.open = false;
        emit(this, 'menuSelect', item.id);
    }

    itemClass(item: MenuItem) {
        return item.danger ? 'danger' : '';
    }
}

component(
    'app-menu',
    {
        prop: ['items'],
        style: css`
            :host {
                position: relative;
                display: block;
                flex: 0 0 auto;
            }

            .icon {
                display: flex;
                align-items: center;
                justify-content: center;
                font: inherit;
                width: 2.6em;
                height: 2.6em;
                padding: 0;
                color: var(--fg-color);
                background: none;
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
                touch-action: manipulation;
            }

            .icon svg {
                width: 1.4em;
                height: 1.4em;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
            }

            ul {
                position: absolute;
                top: calc(100% + 0.4em);
                right: 0;
                z-index: 20;
                min-width: 13em;
                margin: 0;
                padding: 0.3em;
                list-style: none;
                background-color: var(--bg-color);
                border: var(--control-border);
                border-radius: 0.6em;
                box-shadow: 0 0.3em 1.2em rgb(0 0 0 / 0.35);
            }

            li button {
                display: block;
                width: 100%;
                padding: 0.7em 0.8em;
                font: inherit;
                text-align: left;
                white-space: nowrap;
                color: var(--fg-color);
                background: none;
                border: none;
                border-radius: 0.4em;
                cursor: pointer;
            }

            li button:hover:not(:disabled),
            li button:focus-visible {
                background-color: var(--button-bg-color);
            }

            li button.danger {
                color: var(--danger-color);
            }

            li button:disabled {
                opacity: 0.4;
                cursor: default;
            }
        `,
        template: html`
            <button
                class="icon"
                @click.stop="toggle()"
                aria-label="Menu"
                aria-haspopup="true"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
            </button>

            <ul
                *if="open"
                @click.outside="close()"
                @keydown.escape.window="close()"
                role="menu"
            >
                <li *for="item of items track item.id">
                    <button
                        #class="{ danger: item.danger }"
                        .disabled="item.disabled"
                        @click="choose(item)"
                        role="menuitem"
                    >
                        {{ item.label }}
                    </button>
                </li>
            </ul>
        `,
    },
    AppMenuComponent
);
