import { ConfigService } from './config.service';
import { di } from '../di';
import type { Person } from './roster.service';

export type SubmitResult = 'sent' | 'failed';

/**
 * Posts an attendance entry to the configured Google Form.
 *
 * The form is on another origin and sends no CORS headers, so the request
 * goes out `no-cors` and the response is opaque: a resolved promise means the
 * browser handed the request to the network, not that Google accepted it. A
 * rejected one means the entry never left the device. Nothing is queued --
 * the app refuses to take entries while it is offline instead.
 */
export class AttendanceService {
    private _configService = di(ConfigService);

    /**
     * Every known field is sent. A field the person has no value for is sent
     * empty, which Google accepts unless the question is required -- the
     * reason the setup screen warns about columns it could not fill.
     */
    body(person: Person): URLSearchParams | null {
        const fields = this._configService.fields();

        if (!fields.length) {
            return null;
        }

        const body = new URLSearchParams();

        for (const field of fields) {
            body.set(`entry.${field.id}`, person.values[field.label] ?? '');
        }

        return body;
    }

    async submit(person: Person): Promise<SubmitResult> {
        const url = this._configService.formResponseUrl();
        const body = this.body(person);

        if (!url || !body) {
            return 'failed';
        }

        try {
            await fetch(url, { body, method: 'POST', mode: 'no-cors' });
        } catch (_ignore) {
            return 'failed';
        }

        return 'sent';
    }
}
