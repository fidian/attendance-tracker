import { di } from './di';
import { ConfigService } from './services/config.service';
import { InstallPwaService } from './install-pwa/install-pwa.service';
import { OnlineService } from './services/online.service';

export const bootstrap = () => {
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
