import { component, css, emit, html } from 'fudgel';
import { di } from '../di';
import { ScannerService } from '../services/scanner.service';

const FRAME_MS = 200;

export class QrScannerComponent {
    private _scannerService = di(ScannerService);
    private _stream: MediaStream | null = null;
    private _timer?: ReturnType<typeof setTimeout>;

    status = 'Starting the camera...';
    video?: HTMLVideoElement;

    async onViewInit() {
        if (!this._scannerService.isSupported()) {
            this.status =
                'This browser cannot use the camera. Open the shared link on this device instead.';

            return;
        }

        try {
            this._stream = await this._scannerService.getStream();
        } catch (_ignore) {
            this.status =
                'The camera was not allowed. Open the shared link on this device instead.';

            return;
        }

        if (!this.video) {
            return;
        }

        this.video.srcObject = this._stream;
        await this.video.play();
        this.status = 'Point the camera at the code.';
        this._scan();
    }

    onDestroy() {
        clearTimeout(this._timer);
        this._scannerService.stopStream(this._stream);
        this._stream = null;
    }

    cancel() {
        emit(this, 'cancel');
    }

    private _scan() {
        this._timer = setTimeout(async () => {
            if (!this._stream || !this.video) {
                return;
            }

            let found: string | null = null;

            try {
                found = await this._scannerService.detect(this.video);
            } catch (_ignore) {
                this.status = 'This browser could not read the code.';

                return;
            }

            if (found) {
                emit(this, 'scan', found);

                return;
            }

            this._scan();
        }, FRAME_MS);
    }
}

component(
    'qr-scanner',
    {
        style: css`
            :host {
                display: block;
            }

            video {
                display: block;
                width: 100%;
                max-height: 60vh;
                margin-bottom: 0.8em;
                background-color: #000000;
                border-radius: 0.5em;
                object-fit: cover;
            }

            p {
                margin: 0 0 0.8em;
            }

            button {
                width: 100%;
                padding: 0.8em 1.1em;
                font: inherit;
                font-size: 1.05em;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.5em;
                cursor: pointer;
            }
        `,
        template: html`
            <video #ref="video" playsinline muted></video>
            <p>{{ status }}</p>
            <button @click="cancel()">Cancel</button>
        `,
    },
    QrScannerComponent
);
