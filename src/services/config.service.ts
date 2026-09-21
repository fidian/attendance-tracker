import { CONFIG_HASH_KEY } from '../config';
import { LocalStorageService } from './local-storage.service';
import type { LocalStorageInterface } from './local-storage.service';

export interface FormConfig {
    /** The long id from a form's `/d/e/<id>/viewform` URL. */
    formId: string;
    /** The name question's entry id, digits only. */
    nameEntry: string;
}

export type ConfigListener = (config: FormConfig | null) => void;

const FORM_ID = /\/forms\/d\/e\/([A-Za-z0-9_-]+)/;
const ENTRY = /entry\.(\d+)/;
const FORM_ID_ONLY = /^[A-Za-z0-9_-]{20,}$/;
const DIGITS_ONLY = /^\d+$/;

const isFormConfig = (value: FormConfig) =>
    !!value &&
    typeof value.formId === 'string' &&
    typeof value.nameEntry === 'string' &&
    FORM_ID_ONLY.test(value.formId) &&
    DIGITS_ONLY.test(value.nameEntry);

/**
 * Pulls what it can out of whatever was pasted. A pre-filled link (Google
 * Forms' "Get pre-filled link") carries both halves, which is why the config
 * screen asks for one; a plain viewform URL or a bare id gives only the form.
 */
export const parseFormUrl = (
    text: string
): { formId?: string; nameEntry?: string } => {
    const trimmed = (text || '').trim();
    const found: { formId?: string; nameEntry?: string } = {};
    const formId = FORM_ID.exec(trimmed);
    const entry = ENTRY.exec(trimmed);

    if (formId) {
        found.formId = formId[1];
    } else if (FORM_ID_ONLY.test(trimmed)) {
        found.formId = trimmed;
    }

    if (entry) {
        found.nameEntry = entry[1];
    }

    return found;
};

/** The fragment a shared QR code carries, without the leading `#`. */
export const serializeConfig = (config: FormConfig) =>
    `${CONFIG_HASH_KEY}=${config.formId}~${config.nameEntry}`;

export const deserializeConfig = (hash: string): FormConfig | null => {
    const match = new RegExp(
        `(?:^|[#&])${CONFIG_HASH_KEY}=([A-Za-z0-9_-]+)~(\\d+)`
    ).exec(hash || '');

    if (!match) {
        return null;
    }

    const config = { formId: match[1], nameEntry: match[2] };

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

    set(config: FormConfig): boolean {
        if (!isFormConfig(config)) {
            return false;
        }

        this._config = config;
        this._storage.setItem(config);
        this._notify();

        return true;
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

    /** A pre-filled link, shown on the config screen so it can be checked. */
    prefilledUrl() {
        return this._config
            ? `https://docs.google.com/forms/d/e/${this._config.formId}/viewform?usp=pp_url&${this.nameField()}=`
            : null;
    }

    nameField() {
        return this._config ? `entry.${this._config.nameEntry}` : null;
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
