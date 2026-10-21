import { useCallback, useEffect, useRef, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import { isTeacherIdentity } from '../../classSession/classSessionTypes';
import useLocalVideoToggle from '../useLocalVideoToggle/useLocalVideoToggle';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import {
  isAddressedToMe,
  GrantScreenShareMessage,
  isFromTeacher,
  MuteAudioMessage,
  MuteVideoMessage,
  UnmuteRequestMessage,
  VideoRequestMessage,
} from '../useClassDataChannel/classProtocol';

/**
 * Classroom moderation signaling over a Twilio LocalDataTrack.
 *
 * Transport rationale: mirrors useRaiseHand / useAttentionTelemetry — a DataTrack
 * is part of Video core, so it is always available even when Conversations/chat is
 * disabled. There is NO server involved (SDK-as-state, same as the rest). The shared
 * DataTrack scaffold lives in useClassDataChannel; this hook only adds the protocol.
 *
 * IMPORTANT — moderation by convention, NOT a security boundary. A professor cannot
 * reach into another browser and disable its microphone directly: muting is a
 * REQUEST that the target client honors by disabling its OWN local audio track.
 * A modified client could ignore it. This mirrors the room-access guard and the
 * role-is-a-suffix model: a classroom UX guardrail, not enforcement.
 *
 * Browser constraint shaping the design: re-enabling someone's mic without their
 * gesture is invasive, so the professor can only MUTE or ASK. There is intentionally no
 * "force unmute": a 'request-unmute' raises a pending prompt on the student's side and the
 * mic is enabled only when the student accepts it (their click).
 *
 * Protocol:
 * - { type: 'mute-audio', identity } — the professor asks `identity` to mute. Only
 *   the targeted client acts (disables its own audio); the sender identity is the
 *   Twilio participant, never the payload.
 * - { type: 'grant-screenshare', identity, allowed } — the professor allows/revokes screen
 *   sharing for `identity`. Students default to NOT allowed; a revoke stops an active share.
 *   The professor tracks the granted identities and re-sends them when a student (re)connects.
 * - { type: 'request-unmute', identity } — the professor asks `identity` to turn the mic
 *   ON. The target only records a pending request; it never enables the track on its own.
 * - { type: 'mute-video', identity } — the professor asks `identity` to turn the camera OFF.
 *   Obeyed through the same toggle as ToggleVideoButton (unpublish + remove the local track).
 * - { type: 'request-video', identity } — the professor suggests turning the camera ON.
 *   Like request-unmute, only a pending prompt; the camera is published from the student's click.
 */

type ModerationMessage =
  | MuteAudioMessage
  | UnmuteRequestMessage
  | MuteVideoMessage
  | VideoRequestMessage
  | GrantScreenShareMessage;

export interface ModerationApi {
  /** Professor action: ask `identity` to mute their microphone. */
  muteParticipant: (identity: string) => void;
  /** Increments each time the professor mutes THIS participant (drives a toast). */
  mutedByProfessorCount: number;
  /** Professor action: ask `identity` to turn their microphone on (the student must accept). */
  requestUnmute: (identity: string) => void;
  /** True while THIS participant has an unanswered "turn your mic on" request from the professor. */
  unmuteRequestPending: boolean;
  /** Student accepted the request: enable the local audio track and clear the request. */
  acceptUnmuteRequest: () => void;
  /** Student declined / closed the prompt: clear the request without touching the mic. */
  dismissUnmuteRequest: () => void;
  /** Professor action: force `identity`'s camera off. */
  muteVideo: (identity: string) => void;
  /** Increments each time the professor turns THIS participant's camera off (drives a toast). */
  cameraOffByProfessorCount: number;
  /** Professor action: suggest `identity` turn their camera on (the student must accept). */
  requestVideo: (identity: string) => void;
  /** True while THIS participant has an unanswered "turn your camera on" suggestion. */
  cameraRequestPending: boolean;
  /** Student accepted: turn the camera on (from their click) and clear the request. */
  acceptCameraRequest: () => void;
  /** Student declined / closed the prompt: clear the request without touching the camera. */
  dismissCameraRequest: () => void;
  /** Professor action: allow (or revoke) screen sharing for `identity`. */
  grantScreenShare: (identity: string, allowed: boolean) => void;
  /** Professor side: identities currently allowed to share their screen. */
  screenShareGrants: string[];
  /** Student side: whether the professor allowed THIS participant to share. Defaults to false. */
  screenShareAllowed: boolean;
}

export default function useModeration(): ModerationApi {
  const { room, isSharingScreen, toggleScreenShare } = useVideoContext();
  const [mutedByProfessorCount, setMutedByProfessorCount] = useState(0);
  const [unmuteRequestPending, setUnmuteRequestPending] = useState(false);
  const [cameraOffByProfessorCount, setCameraOffByProfessorCount] = useState(0);
  const [cameraRequestPending, setCameraRequestPending] = useState(false);
  const [screenShareAllowed, setScreenShareAllowed] = useState(false);
  // The very same toggle ToggleVideoButton uses: off = unpublish + remove the local track.
  const [isCameraOn, toggleCamera] = useLocalVideoToggle();
  const [screenShareGrants, setScreenShareGrants] = useState<string[]>([]);
  const isTeacher = isTeacherIdentity(room?.localParticipant?.identity);
  // `send` only exists after the channel hook runs, but the connect handler is passed into it.
  const sendRef = useRef<(payload: ModerationMessage) => void>(() => undefined);

  const { send } = useClassDataChannel<ModerationMessage>({
    onParticipantConnected: participant => {
      // DataTracks do not replay: a (re)connecting student would stay locked, so the professor
      // re-sends the grant it holds for that identity.
      if (isTeacher && screenShareGrants.includes(participant.identity)) {
        sendRef.current({ type: 'grant-screenshare', identity: participant.identity, allowed: true });
      }
    },
    onMessage: (message, participant) => {
      const localParticipant = room?.localParticipant;
      if (!localParticipant) return;
      if (message.type === 'mute-audio' && isFromTeacher(participant) && isAddressedToMe(message, room)) {
        // Honor the request by disabling our OWN audio track (soft mute — the track
        // stays published, so the student can re-enable it from their mic button).
        // Only act on tracks that are actually enabled, and bump the count (which
        // drives the toast) only when audio was actually silenced — muting an
        // already-muted mic is a no-op and must not notify the student.
        let didMute = false;
        localParticipant.audioTracks.forEach((publication: any) => {
          const track = publication.track;
          if (track?.isEnabled) {
            track.disable();
            didMute = true;
          }
        });
        if (didMute) {
          setMutedByProfessorCount(count => count + 1);
        }
      }
      if (message.type === 'request-unmute' && isFromTeacher(participant) && isAddressedToMe(message, room)) {
        // NEVER enable the track here: only prompt, and only when the mic is actually off.
        let micIsOff = false;
        localParticipant.audioTracks.forEach((publication: any) => {
          if (publication.track && !publication.track.isEnabled) micIsOff = true;
        });
        if (micIsOff) setUnmuteRequestPending(true);
      }
      if (message.type === 'mute-video' && isFromTeacher(participant) && isAddressedToMe(message, room)) {
        // Only a camera that is actually on is switched off (and only then is the student told).
        if (isCameraOn) {
          toggleCamera();
          setCameraOffByProfessorCount(count => count + 1);
        }
      }
      if (message.type === 'request-video' && isFromTeacher(participant) && isAddressedToMe(message, room)) {
        // NEVER publish the camera here: only prompt, and only when it is off.
        if (!isCameraOn) setCameraRequestPending(true);
      }
      if (message.type === 'grant-screenshare' && isFromTeacher(participant) && isAddressedToMe(message, room)) {
        setScreenShareAllowed(message.allowed === true);
      }
    },
  });

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // A revoke (allowed -> not allowed) while sharing must stop the share.
  const wasAllowedRef = useRef(false);
  useEffect(() => {
    const revoked = wasAllowedRef.current && !screenShareAllowed;
    wasAllowedRef.current = screenShareAllowed;
    if (revoked && !isTeacher && isSharingScreen) toggleScreenShare?.();
  }, [isTeacher, screenShareAllowed, isSharingScreen, toggleScreenShare]);

  const grantScreenShare = useCallback(
    (identity: string, allowed: boolean) => {
      send({ type: 'grant-screenshare', identity, allowed });
      setScreenShareGrants(prev => {
        const without = prev.filter(id => id !== identity);
        return allowed ? [...without, identity] : without;
      });
    },
    [send]
  );

  const muteParticipant = useCallback(
    (identity: string) => {
      send({ type: 'mute-audio', identity });
    },
    [send]
  );

  const requestUnmute = useCallback(
    (identity: string) => {
      send({ type: 'request-unmute', identity });
    },
    [send]
  );

  const muteVideo = useCallback(
    (identity: string) => {
      send({ type: 'mute-video', identity });
    },
    [send]
  );

  const requestVideo = useCallback(
    (identity: string) => {
      send({ type: 'request-video', identity });
    },
    [send]
  );

  const acceptCameraRequest = useCallback(() => {
    if (!isCameraOn) toggleCamera();
    setCameraRequestPending(false);
  }, [isCameraOn, toggleCamera]);

  const dismissCameraRequest = useCallback(() => setCameraRequestPending(false), []);

  const acceptUnmuteRequest = useCallback(() => {
    room?.localParticipant?.audioTracks.forEach((publication: any) => {
      if (publication.track && !publication.track.isEnabled) publication.track.enable();
    });
    setUnmuteRequestPending(false);
  }, [room]);

  const dismissUnmuteRequest = useCallback(() => setUnmuteRequestPending(false), []);

  return {
    muteParticipant,
    mutedByProfessorCount,
    requestUnmute,
    unmuteRequestPending,
    acceptUnmuteRequest,
    dismissUnmuteRequest,
    muteVideo,
    cameraOffByProfessorCount,
    requestVideo,
    cameraRequestPending,
    acceptCameraRequest,
    dismissCameraRequest,
    grantScreenShare,
    screenShareGrants,
    screenShareAllowed,
  };
}
