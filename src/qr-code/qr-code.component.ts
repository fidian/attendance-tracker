import { component, css, html, metadata } from 'fudgel';
import type { ControllerMetadata } from 'fudgel';
import { di } from '../di';
import { QrService } from '../services/qr.service';

export class QrCodeComponent {
    private _qrService = di(QrService);
    [metadata]!: ControllerMetadata;

    content = '';
    holder?: HTMLElement;

    onViewInit() {
        this._draw();
    }

    onChange() {
        this._draw();
    }

    private _draw() {
        if (!this.holder) {
            return;
        }

        // The library hands back a complete SVG document as a string. It is
        // built here from a value this app generated, never from a scan.
        this.holder.innerHTML = this.content
            ? this._qrService.svg(this.content)
            : '';
    }
}

component(
    'qr-code',
    {
        attr: ['content'],
        style: css`
            :host {
                display: block;
            }
        `,
        template: html`<div #ref="holder"></div>`,
    },
    QrCodeComponent
);
