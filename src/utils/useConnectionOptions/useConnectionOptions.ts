import { ConnectOptions } from 'twilio-video';
import { isMobile, removeUndefineds } from '..';
import { useAppState } from '../../state';
import { Settings } from '../../state/settings/settingsReducer';

export interface ConnectionEnvironment {
  isMobile: boolean;
  /** REACT_APP_TWILIO_ENVIRONMENT: 'dev' | 'stage' | 'prod' | undefined. */
  environment?: string;
}

// For mobile browsers, limit the maximum incoming video bitrate to 2.5 Mbps.
const MOBILE_MAX_SUBSCRIPTION_BITRATE = 2500000;

/**
 * Builds the ConnectOptions passed to Video.connect from the user's settings. A pure
 * function of its inputs (the platform and environment are parameters, not module
 * globals), so every branch — mobile, dev, defaults — is unit-testable.
 *
 * See: https://sdk.twilio.com/js/video/releases/2.32.1/docs/global.html#ConnectOptions
 * for available connection options.
 */
export function buildConnectOptions(settings: Settings, platform: ConnectionEnvironment) {
  const { environment } = platform;
  const connectionOptions: ConnectOptions = {
    // Bandwidth Profile, Dominant Speaker, and Network Quality
    // features are only available in Small Group or Group Rooms.
    // Please set "Room Type" to "Group" or "Small Group" in your
    // Twilio Console: https://www.twilio.com/console/video/configure
    bandwidthProfile: {
      video: {
        mode: settings.bandwidthProfileMode,
        dominantSpeakerPriority: settings.dominantSpeakerPriority,
        trackSwitchOffMode: settings.trackSwitchOffMode,
        contentPreferencesMode: settings.contentPreferencesMode,
        clientTrackSwitchOffControl: settings.clientTrackSwitchOffControl,
        ...(platform.isMobile && { maxSubscriptionBitrate: MOBILE_MAX_SUBSCRIPTION_BITRATE }),
      },
    },
    dominantSpeaker: true,
    networkQuality: { local: 1, remote: 1 },

    ...(Number(settings.maxAudioBitrate) > 0 && {
      maxAudioBitrate: Number(settings.maxAudioBitrate),
    }),

    preferredVideoCodecs: 'auto',

    receiveTranscriptions: true,

    //@ts-ignore - Internal use only. This property is not exposed in type definitions.
    environment,

    //@ts-ignore - Internal use only. This property is not exposed in type definitions.
    ...(environment === 'dev' && { wsServer: 'wss://us2.vss.dev.twilio.com/signaling' }),
  };

  // Here we remove any 'undefined' values. The twilio-video SDK will only use defaults
  // when no value is passed for an option. It will throw an error when 'undefined' is passed.
  return removeUndefineds(connectionOptions);
}

export default function useConnectionOptions() {
  const { settings } = useAppState();
  return buildConnectOptions(settings, { isMobile, environment: process.env.REACT_APP_TWILIO_ENVIRONMENT });
}
