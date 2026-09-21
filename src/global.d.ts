declare module '@tofandel/qrcode-svg' {
    interface QrCodeSvgOptions {
        container?: string;
        content: string;
        ecl?: 'L' | 'M' | 'Q' | 'H';
        join?: boolean;
    }

    export default class QrCodeSvg {
        constructor(options: QrCodeSvgOptions);
        svg(): string;
    }
}
