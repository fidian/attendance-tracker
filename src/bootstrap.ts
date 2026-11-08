import { di } from './di';
import {
    ConfigService,
    describeConnectionChange,
    type Connection,
} from './services/config.service';
import { InstallPwaService } from './install-pwa/install-pwa.service';
import { NavigationService } from './services/navigation.service';
import { OnlineService } from './services/online.service';
import { ensureSchema } from './services/schema.service';

export const bootstrap = () => {
    // Before anything reads storage: a record written to an older shape is
    // cleared rather than half-understood.
    ensureSchema();

    const configService = di(ConfigService);

    // A connection handed over by a scanned code arrives in the fragment.
    // Take it before the first screen is chosen, then clear the address so a
    // reload cannot re-apply settings that have since been changed.
    const adopt = () => {
        const confirmReplace = (next: Connection, current: Connection) =>
            confirm(describeConnectionChange(next, current));

        if (configService.adoptFromHash(location.hash, confirmReplace)) {
            history.replaceState(
                null,
                '',
                location.pathname + location.search
            );
        }
    };

    adopt();
    // Opening a shared link while the app is already running only changes the
    // fragment, which reloads nothing, so the same handling runs again.
    addEventListener('hashchange', adopt);

    di(NavigationService).listenForEvents();
    di(OnlineService).listenForEvents();
    di(InstallPwaService).listenForEvents();
};
