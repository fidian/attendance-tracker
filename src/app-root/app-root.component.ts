import { component, css, html } from 'fudgel';
import { di } from '../di';
import { ConfigService } from '../services/config.service';
import { FirebaseService } from '../services/firebase.service';
import { NavigationService, type Screen } from '../services/navigation.service';

/**
 * Picks the screen, and keeps the database connection pointed at whatever the
 * settings currently say.
 *
 * Where you are lives in the query string rather than a fragment, because the
 * fragment belongs to the connection a shared QR code carries. There is no
 * router component: four screens and one parameter do not need one.
 */
export class AppRootComponent {
    private _configService = di(ConfigService);
    private _firebaseService = di(FirebaseService);
    private _navigationService = di(NavigationService);
    private _unsubscribe: (() => void)[] = [];

    /** Shown over everything else until there is somewhere to connect to. */
    setup = true;
    screen: Screen = 'events';

    onInit() {
        this._apply();
        this._unsubscribe.push(
            this._configService.subscribe(() => this._apply()),
            this._navigationService.subscribe(route => {
                this.screen = route.screen;
            })
        );
    }

    onDestroy() {
        for (const unsubscribe of this._unsubscribe) {
            unsubscribe();
        }
    }

    openSetup() {
        this.setup = true;
    }

    closeSetup() {
        this._apply();
    }

    private _apply() {
        const connection = this._configService.get();

        if (connection) {
            this._firebaseService.connect(connection.databaseUrl);
        } else {
            this._firebaseService.disconnect();
        }

        this.setup = !connection;
        this.screen = this._navigationService.current().screen;
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
            <setup-screen
                *if="setup"
                @setup-close="closeSetup()"
            ></setup-screen>

            <event-list-screen
                *if="!setup && screen === 'events'"
                @setup-open="openSetup()"
            ></event-list-screen>

            <event-screen *if="!setup && screen === 'event'"></event-screen>

            <people-screen *if="!setup && screen === 'people'"></people-screen>
        `,
    },
    AppRootComponent
);
