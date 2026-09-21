import { component, css, html } from 'fudgel';
import { di } from '../di';
import { ConfigService } from '../services/config.service';

/**
 * Picks the screen. There is no router: two screens and a fixed base path on
 * GitHub Pages are not worth the URL handling, and the config fragment a
 * shared QR code carries would collide with it.
 */
export class AppRootComponent {
    private _configService = di(ConfigService);
    private _unsubscribe?: () => void;

    screen: 'attendance' | 'config' = 'config';

    onInit() {
        this._pickScreen();
        this._unsubscribe = this._configService.subscribe(() =>
            this._pickScreen()
        );
    }

    onDestroy() {
        this._unsubscribe?.();
    }

    showConfig() {
        this.screen = 'config';
    }

    closeConfig() {
        this._pickScreen();
    }

    private _pickScreen() {
        // Nothing to take attendance with until a form is set up.
        this.screen = this._configService.isConfigured()
            ? 'attendance'
            : 'config';
    }
}

component(
    'app-root',
    {
        style: css`
            :host {
                display: block;
                height: 100%;
                width: 100%;
            }
        `,
        template: html`
            <attendance-screen
                *if="screen === 'attendance'"
                @settings-open="showConfig()"
            ></attendance-screen>
            <config-screen
                *if="screen === 'config'"
                @config-close="closeConfig()"
            ></config-screen>
        `,
    },
    AppRootComponent
);
