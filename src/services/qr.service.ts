import { default as QrCodeSvg } from '@tofandel/qrcode-svg';

export class QrService {
    svg(content: string): string {
        return new QrCodeSvg({
            container: 'svg-viewbox',
            content,
            // The payload is short and the code is read off a bright screen,
            // so the lowest correction level keeps the modules large.
            ecl: 'L',
            join: true,
        }).svg();
    }
}
