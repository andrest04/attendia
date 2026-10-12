import { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';

/**
 * Pure selectors over the SDK's local tracks.
 *
 * The screen share is published as a video track named "screen" (see useScreenShareToggle),
 * so "the camera" means "the video track that is not the screen share". That rule, and the
 * `includes('screen')` naming convention behind it, used to be re-typed in ~16 places; they
 * live here now. These are plain functions rather than new VideoContext fields because dozens
 * of tests mock `useVideoContext` with just `{ room }` or `{ localTracks }`.
 */
export const SCREEN_SHARE_TRACK_NAME = 'screen';

export function isScreenShareName(name: string): boolean {
  return name.includes(SCREEN_SHARE_TRACK_NAME);
}

type LocalTracks = ReadonlyArray<LocalAudioTrack | LocalVideoTrack>;

/** The user's camera: the local video track that is not the screen share. */
export function selectCameraTrack(tracks: LocalTracks): LocalVideoTrack | undefined {
  return tracks.find(track => track.kind === 'video' && !isScreenShareName(track.name)) as LocalVideoTrack | undefined;
}

/** The user's microphone. */
export function selectAudioTrack(tracks: LocalTracks): LocalAudioTrack | undefined {
  return tracks.find(track => track.kind === 'audio') as LocalAudioTrack | undefined;
}
