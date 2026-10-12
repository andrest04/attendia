import React from 'react';
import { LocalAudioTrack } from 'twilio-video';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import AudioLevelIndicator from '../AudioLevelIndicator/AudioLevelIndicator';
import { selectAudioTrack } from '../../utils/trackSelectors';

export default function LocalAudioLevelIndicator() {
  const { localTracks } = useVideoContext();
  const audioTrack = selectAudioTrack(localTracks) as LocalAudioTrack;

  return <AudioLevelIndicator audioTrack={audioTrack} />;
}
