import { component, css, html } from 'fudgel';
import { PeopleScreenComponent } from './people-screen.controller';

export { PeopleScreenComponent };

component(
    'people-screen',
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

            /* The add box, replaced by the delete button while anything is
               ticked -- the two never share the bar. */
            .bar {
                display: flex;
                gap: 0.5em;
                flex: 0 0 auto;
                padding: 0 0.8em 0.6em;
            }

            .bar input {
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

            .bar button {
                padding: 0.7em 1.1em;
                font: inherit;
                font-size: 1.05em;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
                touch-action: manipulation;
            }

            .bar button.primary {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
            }

            .bar button.danger {
                flex: 1;
                color: var(--accent-fg-color);
                background-color: var(--danger-color);
                border-color: var(--danger-color);
            }

            .bar button:disabled {
                opacity: 0.45;
                cursor: default;
            }

            /* The questions this roster asks, under the add box. */
            .fields {
                display: flex;
                flex-direction: column;
                gap: 0.4em;
                flex: 0 0 auto;
                padding: 0 0.8em 0.6em;
            }

            .fields label {
                display: flex;
                align-items: center;
                gap: 0.5em;
            }

            .fields span {
                flex: 0 0 7em;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 0.95em;
                opacity: 0.8;
            }

            .fields input {
                flex: 1;
                min-width: 0;
                padding: 0.6em;
                font-size: 1em;
                font-family: inherit;
                color: var(--fg-color);
                background-color: var(--bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
            }

            .edit label {
                display: block;
                margin-bottom: 0.3em;
                font-weight: bold;
            }

            .edit input {
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

            .edit .row {
                display: flex;
                gap: 0.5em;
                margin-bottom: 1em;
            }

            .edit .row button {
                flex: 1;
                padding: 0.8em 1.1em;
                font: inherit;
                font-size: 1.05em;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
            }

            .edit .row button.primary {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
            }

            .edit .row button:disabled {
                opacity: 0.45;
                cursor: default;
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
                margin-bottom: 0.4em;
            }

            .person {
                display: flex;
                align-items: center;
                gap: 0.6em;
                width: 100%;
                padding: 0.7em 0.8em;
                font: inherit;
                font-size: 1.05em;
                text-align: left;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
                touch-action: manipulation;
            }

            /*
             * Selection must not read as "present" on the other screen, so it
             * is an outline and a tick rather than a filled tile.
             */
            .person.selected {
                border-color: var(--accent-color);
                box-shadow: inset 0 0 0 1px var(--accent-color);
            }

            .box {
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
                width: 1.4em;
                height: 1.4em;
                border: var(--control-border);
                border-radius: 0.3em;
            }

            .person.selected .box {
                color: var(--accent-fg-color);
                background-color: var(--accent-color);
                border-color: var(--accent-color);
            }

            .box svg {
                width: 1em;
                height: 1em;
                fill: none;
                stroke: currentColor;
                stroke-width: 3;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .label {
                flex: 1;
                min-width: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
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
                <button class="back" @click="back()" aria-label="Back to the event">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M15 5l-7 7 7 7" />
                    </svg>
                </button>
                <h1>{{ title(event) }}</h1>
            </header>

            <div class="bar" *if="showAdd(view, selected)">
                <input
                    type="text"
                    autocomplete="off"
                    autocapitalize="words"
                    enterkeyhint="done"
                    placeholder="Add somebody"
                    .value="newName"
                    @input="setNewName($event.target.value)"
                    @keydown.enter.prevent="addPerson()"
                />
                <button
                    class="primary"
                    @click="addPerson()"
                    .disabled="!canAdd(newName, busy)"
                >
                    Add
                </button>
            </div>

            <div
                class="fields"
                *if="showNewFields(view, selected, fields, newName)"
            >
                <label *for="field of fields track field">
                    <span>{{ field }}</span>
                    <input
                        type="text"
                        autocomplete="off"
                        enterkeyhint="done"
                        placeholder="{{ field }}"
                        .value="valueFor(field, newExtra)"
                        @input="setNewExtra(field, $event.target.value)"
                        @keydown.enter.prevent="addPerson()"
                    />
                </label>
            </div>

            <div class="bar" *if="showSelection(view, selected)">
                <button @click="clearSelection()">Cancel</button>
                <button
                    *if="canEdit(selected)"
                    @click="startEdit()"
                    .disabled="busy"
                >
                    Edit
                </button>
                <button
                    class="danger"
                    @click="deleteSelected()"
                    .disabled="busy"
                >
                    Delete {{ selectedCount(selected) }} selected
                </button>
            </div>

            <div class="scroll">
                <p class="error" *if="error">{{ error }}</p>

                <div class="edit" *if="view === 'edit'">
                    <label for="person-name">Name</label>
                    <input
                        id="person-name"
                        type="text"
                        autocomplete="off"
                        autocapitalize="words"
                        .value="editName"
                        @input="setEditName($event.target.value)"
                        @keydown.enter.prevent="saveEdit()"
                    />

                    <div *for="field of fields track field">
                        <label for="person-{{ field }}">{{ field }}</label>
                        <input
                            id="person-{{ field }}"
                            type="text"
                            autocomplete="off"
                            .value="valueFor(field, editExtra)"
                            @input="setEditExtra(field, $event.target.value)"
                            @keydown.enter.prevent="saveEdit()"
                        />
                    </div>

                    <div class="row">
                        <button @click="cancelEdit()">Cancel</button>
                        <button
                            class="primary"
                            @click="saveEdit()"
                            .disabled="!canSave(editName, busy)"
                        >
                            Save
                        </button>
                    </div>
                </div>

                <ul *if="view === 'list'">
                    <li *for="person of people track person.id">
                        <button
                            class="person"
                            #class="{ selected: isSelected(person.id, selected) }"
                            @click="toggleSelected(person)"
                            aria-pressed="{{ isSelected(person.id, selected) }}"
                        >
                            <span class="box">
                                <svg
                                    *if="isSelected(person.id, selected)"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path d="M4 12.5l5.5 6L20 6" />
                                </svg>
                            </span>
                            <span class="label">{{ person.display }}</span>
                        </button>
                    </li>
                </ul>

                <p class="empty" *if="showEmpty(view, loaded, people)">
                    Nobody here yet. Type a name above.
                </p>
                <p class="empty" *if="showLoading(view, loaded)">Loading...</p>
            </div>

            <div class="toast" *if="toast" role="status">{{ toast }}</div>
        `,
    },
    PeopleScreenComponent
);
