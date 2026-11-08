import { di } from '../di';
import { ConfigService } from './config.service';
import { FirebaseService } from './firebase.service';
import { fromBackup, toBackup, type Backup } from './sheet.service';

/**
 * The whole group in one file, and back again.
 *
 * Firebase does not pause a project for being idle, but Google does
 * eventually reclaim an abandoned one, and a group cannot be deleted from
 * inside the app — the rule that stops one request erasing everything stops
 * that too. A file you hold is the way out of both.
 */
export class BackupService {
    private _configService = di(ConfigService);
    private _firebaseService = di(FirebaseService);

    async create(): Promise<Backup> {
        const path = this._configService.groupPath();
        const [events, roster] = await Promise.all([
            this._firebaseService.read<unknown>(`${path}/events`),
            this._firebaseService.read<unknown>(`${path}/roster`),
        ]);

        return toBackup(events, roster);
    }

    /**
     * Replaces every event and roster in this group. The group marker is
     * written first, because the rules refuse any write that would leave a
     * group empty and a restore of nothing would do exactly that.
     */
    async restore(raw: unknown): Promise<number> {
        const backup = fromBackup(raw);

        if (!backup) {
            throw new Error(
                'That is not a backup this app wrote, or it is from a newer version.'
            );
        }

        const path = this._configService.groupPath();
        await this._firebaseService.write(`${path}/meta/createdAt`, Date.now());
        await this._firebaseService.writeMany(path, {
            events: backup.events,
            roster: backup.roster,
        });

        return Object.keys(backup.events).length;
    }
}
