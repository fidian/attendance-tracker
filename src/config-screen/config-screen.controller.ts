/**
 * Split from the `component()` call so the behavior is unit-testable under
 * Node. See the note on the attendance screen's controller.
 */
import { emit } from 'fudgel';
import { di } from '../di';
import { DOCS, PROJECT_URL } from '../config';
import { ConfigService, parseFormUrl } from '../services/config.service';
import type { FormField } from '../services/config.service';
import { CsvService } from '../services/csv.service';
import { RosterService } from '../services/roster.service';
import { clearEverything } from '../services/schema.service';

export type ConfigView = 'edit' | 'share' | 'scan';

export class ConfigScreenComponent {
    private _configService = di(ConfigService);
    private _csvService = di(CsvService);
    private _rosterService = di(RosterService);

    busy = false;
    confirming = false;
    csvUrl = '';
    error = '';
    fields: FormField[] = [];
    formId = '';
    docs = DOCS;
    notice = '';
    projectUrl = PROJECT_URL;
    /** True when there is somewhere to go back to. */
    saved = false;
    /** Set when the share view opens; a no-argument call binds only once. */
    shareLink = '';
    view: ConfigView = 'edit';

    onInit() {
        const config = this._configService.get();
        this.saved = !!config;
        this.formId = config?.formId || '';
        this.fields = config?.fields || [];
        this.csvUrl = config?.csvUrl || '';
    }

    /**
     * Accepts a pre-filled link and reads every question out of it at once.
     * A plain form URL or a bare id gives only the form, which is not enough
     * to post anything, so the screen says what is missing.
     */
    setFormUrl(text: string) {
        const found = parseFormUrl(text);
        this.formId = found.formId || text.trim();

        if (found.fields.length) {
            this.fields = found.fields;
        }

        this.error = '';
        this.notice = '';
    }

    setCsvUrl(text: string) {
        this.csvUrl = text.trim();
        this.error = '';
        this.notice = '';
    }

    fieldSummary(fields: FormField[]) {
        return fields.length === 1
            ? '1 question found'
            : `${fields.length} questions found`;
    }

    canSave(formId: string, fields: FormField[]) {
        return !!formId.trim() && fields.length > 0;
    }

    save(): boolean {
        const ok = this._configService.set({
            formId: this.formId.trim(),
            fields: this.fields,
            csvUrl: this.csvUrl.trim() || undefined,
        });

        if (!ok) {
            this.error = this.fields.length
                ? 'That does not look like a Google Form link.'
                : 'No questions found in that link. Use "Get pre-filled link", type each question\'s name into its own box, then copy the whole address.';

            return false;
        }

        this.saved = true;
        this.error = '';
        this.close();

        return true;
    }

    /**
     * Replaces the roster from a published sheet. The first column is what
     * the list shows; the rest fill the questions whose labels they match.
     */
    async importCsv() {
        const url = this.csvUrl.trim();

        if (!url || this.busy) {
            return;
        }

        this.busy = true;
        this.error = '';
        this.notice = '';

        try {
            const result = await this._csvService.fetchPeople(
                url,
                this.fields.map(field => field.label)
            );
            const dropped = this._rosterService.replaceAll(result.people);
            this._configService.setCsvUrl(url);
            this.notice = this._importNotice(
                result.people.length - dropped,
                dropped,
                result.missingFields,
                result.unmatchedColumns
            );
        } catch (error) {
            this.error = (error as Error).message;
        }

        this.busy = false;
    }

    private _importNotice(
        imported: number,
        dropped: number,
        missingFields: string[],
        unmatchedColumns: string[]
    ) {
        const parts = [`Imported ${imported} people.`];

        if (dropped) {
            parts.push(`${dropped} past the limit were left out.`);
        }

        if (missingFields.length) {
            parts.push(
                `No column for ${missingFields.join(', ')} -- those go out empty, which Google rejects if the question is required.`
            );
        }

        if (unmatchedColumns.length) {
            parts.push(
                `Ignored ${unmatchedColumns.join(', ')}: no question has that name.`
            );
        }

        return parts.join(' ');
    }

    /** Takes settings out of a scanned QR code and keeps them. */
    acceptScan(text: string): boolean {
        if (this._configService.adoptFromHash(text)) {
            this.onInit();
            this.view = 'edit';

            return true;
        }

        const found = parseFormUrl(text);

        if (found.formId && found.fields.length) {
            this.formId = found.formId;
            this.fields = found.fields;
            this.view = 'edit';

            return true;
        }

        this.error = 'That code does not carry any form settings.';

        return false;
    }

    show(view: ConfigView) {
        this.error = '';
        this.notice = '';
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

    /** Forgets the form settings and everyone on this device. */
    clearAll() {
        this.confirming = false;
        clearEverything();
        this._rosterService.replaceAll([]);
        this._configService.clear();
        this.formId = '';
        this.fields = [];
        this.csvUrl = '';
        this.saved = false;
        this.view = 'edit';
        emit(this, 'cleared');
    }

    close() {
        emit(this, 'configClose');
    }
}
