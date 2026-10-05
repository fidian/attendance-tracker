import { di } from './di';
import { ConfigService } from './services/config.service';
import { InstallPwaService } from './install-pwa/install-pwa.service';
import { OnlineService } from './services/online.service';
import { ensureSchema } from './services/schema.service';

export const bootstrap = () => {
    // Before anything reads storage: a record written to an older shape is
    // cleared rather than half-understood.
    ensureSchema();

    const configService = di(ConfigService);

    // Settings handed over by a scanned QR code arrive in the fragment. Take
    // them before the first screen is chosen, then clear the address so a
    // reload cannot re-apply settings that have since been changed.
    const adopt = () => {
        if (configService.adoptFromHash()) {
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

    di(OnlineService).listenForEvents();
    di(InstallPwaService).listenForEvents();
};
