import { component, css, html, metadata } from 'fudgel';
import type { ControllerMetadata } from 'fudgel';
import { di } from '../di';
import { InstallPwaService } from './install-pwa.service';

export class InstallPwaComponent {
    private _installPwaService = di(InstallPwaService);
    [metadata]!: ControllerMetadata;

    install() {
        this._installPwaService.triggerSavedEvent();
        this.dismiss();
    }

    dismiss() {
        this[metadata].host?.remove();
    }
}

component(
    'install-pwa',
    {
        style: css`
            :host {
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10;
                display: flex;
                align-items: center;
                gap: 0.5em;
                padding: 0.7em 1em calc(0.7em + env(safe-area-inset-bottom));
                background-color: var(--notice-bg-color);
                border-top: var(--control-border);
            }

            span {
                flex: 1;
            }

            button {
                padding: 0.5em 0.9em;
                font: inherit;
                color: var(--fg-color);
                background-color: var(--button-bg-color);
                border: var(--control-border);
                border-radius: 0.4em;
                cursor: pointer;
            }
        `,
        template: html`
            <span>Add this to your home screen for one-tap check in.</span>
            <button @click="dismiss()">Not now</button>
            <button @click="install()">Install</button>
        `,
    },
    InstallPwaComponent
);
