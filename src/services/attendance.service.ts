import { ConfigService } from './config.service';
import { di } from '../di';

export type SubmitResult = 'sent' | 'failed';

/**
 * Posts an attendance entry to the configured Google Form.
 *
 * The form is on another origin and sends no CORS headers, so the request goes
 * out `no-cors` and the response is opaque: a resolved promise means the
 * browser handed the request to the network, not that Google accepted it. A
 * rejected one means the entry never left the device. Nothing is queued -- the
 * app refuses to take entries while it is offline instead.
 */
export class AttendanceService {
    private _configService = di(ConfigService);

    async submit(name: string): Promise<SubmitResult> {
        const url = this._configService.formResponseUrl();
        const field = this._configService.nameField();

        if (!url || !field) {
            return 'failed';
        }

        const body = new URLSearchParams();
        body.set(field, name);

        try {
            await fetch(url, { body, method: 'POST', mode: 'no-cors' });
        } catch (_ignore) {
            return 'failed';
        }

        return 'sent';
    }
}
