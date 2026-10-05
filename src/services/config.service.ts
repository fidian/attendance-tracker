import { CONFIG_HASH_KEY } from '../config';
import { LocalStorageService } from './local-storage.service';
import type { LocalStorageInterface } from './local-storage.service';

/** One short-answer question on the form. */
export interface FormField {
    /** The digits of its `entry.N` parameter. */
    id: string;
    /**
     * What the leader typed into that box when they made the pre-filled
     * link, which is the only way to learn a question's wording without the
     * OAuth-gated Forms API. It is also the CSV column header that fills it.
     */
    label: string;
}

export interface FormConfig {
    /** The long id from a form's `/d/e/<id>/viewform` URL. */
    formId: string;
    fields: FormField[];
    /** A published-to-web CSV holding the roster, if there is one. */
    csvUrl?: string;
}

export type ConfigListener = (config: FormConfig | null) => void;

const FORM_ID = /\/forms\/d\/e\/([A-Za-z0-9_-]+)/;
const FORM_ID_ONLY = /^[A-Za-z0-9_-]{20,}$/;
const DIGITS_ONLY = /^\d+$/;

const isFormConfig = (value: FormConfig) =>
    !!value &&
    typeof value.formId === 'string' &&
    FORM_ID_ONLY.test(value.formId) &&
    Array.isArray(value.fields) &&
    value.fields.length > 0 &&
    value.fields.every(
        field =>
            !!field &&
            typeof field.id === 'string' &&
            DIGITS_ONLY.test(field.id) &&
            typeof field.label === 'string' &&
            !!field.label.trim()
    ) &&
    (value.csvUrl === undefined || typeof value.csvUrl === 'string');

/**
 * Reads a pre-filled form link.
 *
 * Google puts every box that was filled in into the address as
 * `entry.<id>=<value>`, in the order the questions appear. Asking the leader
 * to type each question's *label* into its own box therefore hands over the
 * ids and the wording together, in one paste, with no authentication.
 */
export const parseFormUrl = (
    text: string
): { formId?: string; fields: FormField[] } => {
    const trimmed = (text || '').trim();
    const found: { formId?: string; fields: FormField[] } = { fields: [] };
    const formId = FORM_ID.exec(trimmed);

    if (formId) {
        found.formId = formId[1];
    } else if (FORM_ID_ONLY.test(trimmed)) {
        found.formId = trimmed;
    }

    const query = trimmed.slice(trimmed.indexOf('?') + 1).split('#')[0];

    if (trimmed.includes('?')) {
        for (const [key, value] of new URLSearchParams(query)) {
            const id = /^entry\.(\d+)$/.exec(key);

            if (id && value.trim()) {
                found.fields.push({ id: id[1], label: value.trim() });
            }
        }
    }

    return found;
};

/** The fragment a shared QR code carries, without the leading `#`. */
export const serializeConfig = (config: FormConfig) => {
    const payload = [
        config.formId,
        ...config.fields.map(field => `${field.id}:${field.label}`),
    ].join('~');

    return `${CONFIG_HASH_KEY}=${encodeURIComponent(payload)}${
        config.csvUrl ? `&csv=${encodeURIComponent(config.csvUrl)}` : ''
    }`;
};

export const deserializeConfig = (hash: string): FormConfig | null => {
    const text = hash || '';
    const match = new RegExp(`(?:^|[#&])${CONFIG_HASH_KEY}=([^&#]+)`).exec(
        text
    );

    if (!match) {
        return null;
    }

    const parts = decodeURIComponent(match[1]).split('~');
    const csv = /(?:^|[#&])csv=([^&#]+)/.exec(text);
    const config: FormConfig = {
        formId: parts[0],
        fields: parts.slice(1).map(part => {
            const at = part.indexOf(':');

            return { id: part.slice(0, at), label: part.slice(at + 1) };
        }),
    };

    if (csv) {
        config.csvUrl = decodeURIComponent(csv[1]);
    }

    return isFormConfig(config) ? config : null;
};

export class ConfigService {
    private _config: FormConfig | null;
    private _listeners = new Set<ConfigListener>();
    private _storage: LocalStorageInterface<FormConfig>;

    constructor() {
        this._storage = LocalStorageService.json<FormConfig>(
            'formConfig',
            1,
            isFormConfig
        );
        this._config = this._storage.getItem();
    }

    get(): FormConfig | null {
        return this._config;
    }

    isConfigured() {
        return !!this._config;
    }

    fields(): FormField[] {
        return this._config?.fields || [];
    }

    /** The CSV column headers a roster file has to carry. */
    fieldLabels(): string[] {
        return this.fields().map(field => field.label);
    }

    csvUrl() {
        return this._config?.csvUrl || '';
    }

    set(config: FormConfig): boolean {
        if (!isFormConfig(config)) {
            return false;
        }

        this._config = config;
        this._storage.setItem(config);
        this._notify();

        return true;
    }

    setCsvUrl(url: string) {
        if (!this._config) {
            return false;
        }

        const trimmed = url.trim();

        return this.set({
            ...this._config,
            csvUrl: trimmed || undefined,
        });
    }

    clear() {
        this._config = null;
        this._storage.reset();
        this._notify();
    }

    /** Where an entry is posted. Null until the app has been configured. */
    formResponseUrl() {
        return this._config
            ? `https://docs.google.com/forms/d/e/${this._config.formId}/formResponse`
            : null;
    }

    /**
     * The URL a shared QR code encodes: this app, carrying the settings. A
     * phone camera opens it and the app configures itself on load.
     */
    shareUrl(appUrl = location.href) {
        if (!this._config) {
            return null;
        }

        return `${appUrl.split('#')[0]}#${serializeConfig(this._config)}`;
    }

    /**
     * Reads settings handed over in the address bar and keeps them. The
     * fragment is stripped afterwards so a reload does not re-apply settings
     * that have since been changed.
     */
    adoptFromHash(hash = location.hash): boolean {
        const config = deserializeConfig(hash);

        if (!config) {
            return false;
        }

        this.set(config);

        return true;
    }

    subscribe(listener: ConfigListener): () => void {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    private _notify() {
        for (const listener of this._listeners) {
            listener(this._config);
        }
    }
}
