import { Settings } from '../../state/settings/settingsReducer';
import { useAppState } from '../../state';
import useConnectionOptions, { buildConnectOptions } from './useConnectionOptions';

const mockUseAppState = useAppState as jest.Mock<any>;
jest.mock('../../state');

describe('the useConnectionOptions function', () => {
  it('should remove any undefined values from settings', () => {
    const settings: Settings = {
      trackSwitchOffMode: undefined,
      dominantSpeakerPriority: undefined,
      bandwidthProfileMode: undefined,
      maxAudioBitrate: '',
      clientTrackSwitchOffControl: 'manual',
      contentPreferencesMode: 'auto',
    };

    const result = {
      bandwidthProfile: {
        video: {
          clientTrackSwitchOffControl: 'manual',
          contentPreferencesMode: 'auto',
        },
      },
      dominantSpeaker: true,
      networkQuality: { local: 1, remote: 1 },
      preferredVideoCodecs: 'auto',
      receiveTranscriptions: true,
    };

    mockUseAppState.mockImplementationOnce(() => ({ settings }));
    expect(useConnectionOptions()).toEqual(result);
  });

  it('should correctly generate settings', () => {
    const settings: Settings = {
      trackSwitchOffMode: 'detected',
      dominantSpeakerPriority: 'high',
      bandwidthProfileMode: 'collaboration',
      maxAudioBitrate: '0',
      contentPreferencesMode: 'auto',
      clientTrackSwitchOffControl: 'manual',
    };

    const result = {
      bandwidthProfile: {
        video: {
          dominantSpeakerPriority: 'high',
          mode: 'collaboration',
          trackSwitchOffMode: 'detected',
          contentPreferencesMode: 'auto',
          clientTrackSwitchOffControl: 'manual',
        },
      },
      dominantSpeaker: true,
      networkQuality: { local: 1, remote: 1 },
      preferredVideoCodecs: 'auto',
      receiveTranscriptions: true,
    };

    mockUseAppState.mockImplementationOnce(() => ({ settings }));
    expect(useConnectionOptions()).toEqual(result);
  });
});

describe('the buildConnectOptions function', () => {
  const settings: Settings = {
    trackSwitchOffMode: 'detected',
    dominantSpeakerPriority: 'high',
    bandwidthProfileMode: 'collaboration',
    maxAudioBitrate: '16000',
    contentPreferencesMode: 'auto',
    clientTrackSwitchOffControl: 'manual',
  };

  it('does not cap the subscription bitrate on desktop', () => {
    const options: any = buildConnectOptions(settings, { isMobile: false });
    expect(options.bandwidthProfile.video).not.toHaveProperty('maxSubscriptionBitrate');
  });

  it('caps the incoming video bitrate at 2.5 Mbps on mobile', () => {
    const options: any = buildConnectOptions(settings, { isMobile: true });
    expect(options.bandwidthProfile.video.maxSubscriptionBitrate).toBe(2500000);
  });

  it('applies the audio bitrate cap only when it is a positive number', () => {
    expect((buildConnectOptions(settings, { isMobile: false }) as any).maxAudioBitrate).toBe(16000);
    expect(buildConnectOptions({ ...settings, maxAudioBitrate: '0' }, { isMobile: false })).not.toHaveProperty(
      'maxAudioBitrate'
    );
  });

  it('points at the dev signaling server only in the dev environment', () => {
    const dev: any = buildConnectOptions(settings, { isMobile: false, environment: 'dev' });
    expect(dev.environment).toBe('dev');
    expect(dev.wsServer).toBe('wss://us2.vss.dev.twilio.com/signaling');

    const prod: any = buildConnectOptions(settings, { isMobile: false, environment: 'prod' });
    expect(prod.environment).toBe('prod');
    expect(prod).not.toHaveProperty('wsServer');
  });

  it('never leaves an undefined value for the SDK to choke on', () => {
    const options: any = buildConnectOptions(settings, { isMobile: false });
    expect(options).not.toHaveProperty('environment');
    expect(JSON.stringify(options)).not.toContain('undefined');
  });
});
