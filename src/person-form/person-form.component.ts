import { component, css, emit, html, metadata } from 'fudgel';
import type { ControllerMetadata } from 'fudgel';
import type { FormField } from '../services/config.service';

/**
 * Asks for every question the form has, so someone can be added with no CSV
 * anywhere in sight. The label shown in the list is its own box, because the
 * CSV's first column is its own column: it is often a shorthand like
 * "Claude (123)" rather than any one field.
 */
export class PersonFormComponent {
    private _touchedLabel = false;

    [metadata]!: ControllerMetadata;
    fields: FormField[] = [];
    label = '';
    values: Record<string, string> = {};

    onViewInit() {
        // A `#ref` inside a `*for` keeps the last row, so the first box is
        // found in the DOM instead.
        this[metadata].host?.querySelector('input')?.focus();
    }

    /**
     * An absent value has to come back as an empty string: assigning
     * `undefined` to an input's value property puts the word "undefined" in
     * the box.
     */
    valueFor(values: Record<string, string>, field: FormField) {
        return values[field.label] || '';
    }

    /** The label falls back to the field values joined, which is usually it. */
    suggestedLabel(values: Record<string, string>, fields: FormField[]) {
        return fields
            .map(field => (values[field.label] || '').trim())
            .filter(value => !!value)
            .join(' ');
    }

    labelFor(values: Record<string, string>, fields: FormField[], label: string) {
        return label.trim() || this.suggestedLabel(values, fields);
    }

    setValue(field: FormField, value: string) {
        this.values = { ...this.values, [field.label]: value };

        if (!this._touchedLabel) {
            this.label = '';
        }
    }

    setLabel(value: string) {
        this._touchedLabel = true;
        this.label = value;
    }

    canSave(values: Record<string, string>, fields: FormField[], label: string) {
        return !!this.labelFor(values, fields, label);
    }

    save() {
        const label = this.labelFor(this.values, this.fields, this.label);

        if (!label) {
            return;
        }

        emit(this, 'personAdd', { label, values: { ...this.values } });
    }

    cancel() {
        emit(this, 'cancel');
    }
}

component(
    'person-form',
    {
        prop: ['fields'],
        style: css`
            :host {
                display: block;
                padding: 0.8em;
                margin-bottom: 0.6em;
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.6em;
            }

            label {
                display: block;
                margin-bottom: 0.2em;
                font-size: 0.9em;
                font-weight: bold;
            }

            input {
                width: 100%;
                box-sizing: border-box;
                margin-bottom: 0.7em;
                padding: 0.6em;
                font-size: 1.05em;
                font-family: inherit;
                color: var(--fg-color);
                background-color: var(--bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
            }

            .hint {
                margin: -0.4em 0 0.9em;
                font-size: 0.85em;
                opacity: 0.7;
            }

            .row {
                display: flex;
                gap: 0.5em;
            }

            button {
                flex: 1;
                padding: 0.7em;
                font: inherit;
                font-size: 1.05em;
                color: var(--fg-color);
                background-color: var(--bg-color);
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
        `,
        template: html`
            <form @submit.prevent="save()">
                <div *for="field of fields">
                    <label for="field-{{ field.id }}">{{ field.label }}</label>
                    <input
                        id="field-{{ field.id }}"
                        type="text"
                        autocomplete="off"
                        .value="valueFor(values, field)"
                        @input="setValue(field, $event.target.value)"
                    />
                </div>

                <label for="person-label">Shown in the list</label>
                <input
                    id="person-label"
                    type="text"
                    autocomplete="off"
                    placeholder="{{ suggestedLabel(values, fields) }}"
                    .value="label"
                    @input="setLabel($event.target.value)"
                />
                <p class="hint">Leave blank to use the boxes above.</p>

                <div class="row">
                    <button type="button" @click="cancel()">Cancel</button>
                    <button
                        class="primary"
                        type="submit"
                        .disabled="!canSave(values, fields, label)"
                    >
                        Add and mark here
                    </button>
                </div>
            </form>
        `,
    },
    PersonFormComponent
);
