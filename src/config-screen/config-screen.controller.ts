/**
 * Split from the `component()` call so the behavior is unit-testable under
 * Node. See the note on the attendance screen's controller.
 */
import { emit } from 'fudgel';
import { di } from '../di';
import { STORAGE_KEYS } from '../config';
import { ConfigService, parseFormUrl } from '../services/config.service';
import { storage } from '../services/local-storage.service';

export type ConfigView = 'edit' | 'share' | 'scan';

export class ConfigScreenComponent {
    private _configService = di(ConfigService);

    confirming = false;
    error = '';
    formId = '';
    /** Set when the share view opens; a no-argument call binds only once. */
    shareLink = '';
    nameEntry = '';
    /** True when there is somewhere to go back to. */
    saved = false;
    view: ConfigView = 'edit';

    onInit() {
        const config = this._configService.get();
        this.saved = !!config;
        this.formId = config?.formId || '';
        this.nameEntry = config?.nameEntry || '';
    }

    /**
     * Accepts a pre-filled link, a plain form URL, or a bare form id, and
     * fills in whichever halves it can find. A pre-filled link carries both,
     * which is why the screen asks for one.
     */
    setFormUrl(text: string) {
        const found = parseFormUrl(text);
        this.formId = found.formId || text.trim();

        if (found.nameEntry) {
            this.nameEntry = found.nameEntry;
        }

        this.error = '';
    }

    setNameEntry(text: string) {
        const found = parseFormUrl(text);
        this.nameEntry = found.nameEntry || text.trim();
        this.error = '';
    }

    canSave(formId: string, nameEntry: string) {
        return !!formId.trim() && !!nameEntry.trim();
    }

    save(): boolean {
        const ok = this._configService.set({
            formId: this.formId.trim(),
            nameEntry: this.nameEntry.trim(),
        });

        if (!ok) {
            this.error =
                'That does not look like a Google Form link. Use "Get pre-filled link" on the form and paste the whole address.';

            return false;
        }

        this.saved = true;
        this.error = '';
        this.close();

        return true;
    }

    /** Takes settings out of a scanned QR code and keeps them. */
    acceptScan(text: string): boolean {
        if (this._configService.adoptFromHash(text)) {
            this.onInit();
            this.view = 'edit';

            return true;
        }

        const found = parseFormUrl(text);

        if (found.formId && found.nameEntry) {
            this.formId = found.formId;
            this.nameEntry = found.nameEntry;
            this.view = 'edit';

            return true;
        }

        this.error = 'That code does not carry any form settings.';

        return false;
    }

    show(view: ConfigView) {
        this.error = '';
        this.confirming = false;
        this.shareLink =
            view === 'share' ? this._configService.shareUrl() || '' : '';
        this.view = view;
    }

    confirmClear() {
        this.confirming = true;
    }

    cancelClear() {
        this.confirming = false;
    }

    /** Forgets the form settings and every name on this device. */
    clearAll() {
        this.confirming = false;

        for (const key of STORAGE_KEYS) {
            storage.removeItem(key);
        }

        this._configService.clear();
        this.formId = '';
        this.nameEntry = '';
        this.saved = false;
        this.view = 'edit';
        emit(this, 'cleared');
    }

    close() {
        emit(this, 'configClose');
    }
}
