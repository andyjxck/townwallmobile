import { getCurrentConference } from '../../base/conference/functions';
import StateListenerRegistry from '../../base/redux/StateListenerRegistry';

/**
 * Wake lock disabled.
 * Expo keep-awake is used instead to avoid RCT-Folly crashes.
 */
StateListenerRegistry.register(
    /* selector */ state => {
        const { enabled: audioOnly } = state['features/base/audio-only'];
        const conference = getCurrentConference(state);

        return Boolean(conference && !audioOnly);
    },
    /* listener */ () => {}
);
