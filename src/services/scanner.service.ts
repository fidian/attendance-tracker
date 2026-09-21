export type ScannerKind = 'native' | 'wasm';

interface Detector {
    detect(source: HTMLCanvasElement): Promise<{ rawValue: string }[]>;
}

const getNative = () => (window as any).BarcodeDetector;

/**
 * Reads a QR code out of a live camera frame.
 *
 * Chromium has `BarcodeDetector` built in. Safari does not, so the WebAssembly
 * decoder is fetched the first time a scan is started there and never lands in
 * the main bundle.
 */
export class ScannerService {
    private _canvas?: HTMLCanvasElement;
    private _context?: CanvasRenderingContext2D | null;
    private _detector?: Promise<Detector>;

    kind(): ScannerKind {
        return getNative() ? 'native' : 'wasm';
    }

    isSupported() {
        return !!navigator.mediaDevices?.getUserMedia;
    }

    getStream() {
        return navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'environment' },
        });
    }

    stopStream(stream: MediaStream | null | undefined) {
        for (const track of stream?.getTracks() || []) {
            track.stop();
        }
    }

    /** The QR payload in this frame, or null if there is not one yet. */
    async detect(video: HTMLVideoElement): Promise<string | null> {
        if (!video.videoWidth || !video.videoHeight) {
            return null;
        }

        const canvas = this._getCanvas(video.videoWidth, video.videoHeight);
        const context = this._context;

        if (!context) {
            return null;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const detector = await this._getDetector();
        const found = await detector.detect(canvas);

        return found[0]?.rawValue || null;
    }

    private _getCanvas(width: number, height: number) {
        let canvas = this._canvas;

        if (!canvas) {
            this._canvas = canvas = document.createElement('canvas');
            this._context = null;
        }

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            this._context = null;
        }

        if (!this._context) {
            this._context = canvas.getContext('2d', {
                willReadFrequently: true,
            });
        }

        return canvas;
    }

    private _getDetector(): Promise<Detector> {
        if (!this._detector) {
            const Native = getNative();
            this._detector = Native
                ? Promise.resolve(new Native({ formats: ['qr_code'] }))
                : this._loadWasm();
        }

        return this._detector;
    }

    private async _loadWasm(): Promise<Detector> {
        const zbar = await import('@undecaf/zbar-wasm');

        return {
            async detect(canvas: HTMLCanvasElement) {
                const context = canvas.getContext('2d', {
                    willReadFrequently: true,
                });

                if (!context) {
                    return [];
                }

                const image = context.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
                const symbols = await zbar.scanImageData(image);

                return symbols.map(symbol => ({
                    rawValue: symbol.decode(),
                }));
            },
        };
    }
}
