/**
 * Split from the `component()` call so the behavior is testable under Node.
 * See AGENTS.md.
 */
import { emit } from 'fudgel';
import { di } from '../di';
import { DOCS, PROJECT_URL } from '../config';
import {
    ConfigService,
    deserializeConnection,
    newGroupId,
    normalizeDatabaseUrl,
} from '../services/config.service';

export type SetupView = 'edit' | 'share' | 'scan';

export class SetupScreenComponent {
    private _configService = di(ConfigService);

    databaseUrl = '';
    docs = DOCS;
    error = '';
    projectUrl = PROJECT_URL;
    /** True once this device has a connection, so there is a way back. */
    saved = false;
    shareLink = '';
    view: SetupView = 'edit';

    onInit() {
        const connection = this._configService.get();
        this.saved = !!connection;
        this.databaseUrl = connection?.databaseUrl || '';
    }

    setDatabaseUrl(text: string) {
        this.databaseUrl = text;
        this.error = '';
    }

    canSave(databaseUrl: string) {
        return !!databaseUrl.trim();
    }

    /**
     * Keeps the group id this device already had, so saving a corrected
     * address does not strand the data. A device being set up for the first
     * time gets a fresh one.
     */
    save(): boolean {
        const databaseUrl = normalizeDatabaseUrl(this.databaseUrl);

        if (!databaseUrl) {
            this.error =
                'That does not look like a Realtime Database address. It ends in firebaseio.com or firebasedatabase.app, and the Data tab of the database shows it.';

            return false;
        }

        const groupId = this._configService.groupId() || newGroupId();

        if (!this._configService.set({ databaseUrl, groupId })) {
            this.error = 'Those settings could not be saved.';

            return false;
        }

        this.databaseUrl = databaseUrl;
        this.saved = true;
        this.error = '';
        this.close();

        return true;
    }

    /** Takes a whole connection out of a scanned code. */
    acceptScan(text: string): boolean {
        const connection = deserializeConnection(text);

        if (!connection || !this._configService.set(connection)) {
            this.error =
                'That code does not carry a database address and group.';
            this.view = 'edit';

            return false;
        }

        this.onInit();
        this.view = 'edit';
        this.close();

        return true;
    }

    show(view: SetupView) {
        this.error = '';
        this.shareLink =
            view === 'share' ? this._configService.shareUrl() || '' : '';
        this.view = view;
    }

    /**
     * Forgets this device's connection. The data itself is untouched -- the
     * rules refuse a write that would empty a group, so there is no way to
     * delete one from here, and the README says so.
     */
    clearAll() {
        this._configService.clear();
        this.databaseUrl = '';
        this.saved = false;
        this.shareLink = '';
        this.view = 'edit';
    }

    close() {
        emit(this, 'setupClose');
    }
}
