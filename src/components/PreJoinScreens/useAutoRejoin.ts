import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../state';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { clearRejoinSession, getResumableSession, RejoinSession } from './rejoinSession';
import { featureFlags } from '../../utils/featureFlags';

/*
 * Reconnects automatically after a full page refresh.
 *
 * When the app loads on /room/:name with no live Room, it normally drops to the lobby.
 * If a session was persisted for this exact room (see rejoinSession), we instead
 * re-acquire local media, fetch a fresh token for the saved identity, and reconnect to
 * video (and chat). The Room then mounts and PreJoinScreens unmounts.
 *
 * Returns `true` while a rejoin is in flight so the caller can show a reconnecting state
 * instead of the lobby.
 *
 * Resilience: `useRoom`'s connect resolves (not rejects) on an SDK-level failure and
 * surfaces the problem through the app error state instead. On a refresh, reconnecting with
 * the SAME identity can transiently race the server tearing down the old participant, so we
 * retry ONCE (after a short delay) before giving up. We never clear the session on an SDK
 * error — keeping it preserves the correct role for the fallback lobby and lets the next
 * manual refresh retry. The session is only cleared on a genuine token rejection (room
 * closed / passcode expired), which is a real refusal, not transient.
 */

const RETRY_DELAY_MS = 2000;

export default function useAutoRejoin(urlRoomName: string | undefined): boolean {
  const { getToken, error, setError } = useAppState();
  const {
    connect: videoConnect,
    getAudioAndVideoTracks,
    removeLocalAudioTrack,
    removeLocalVideoTrack,
  } = useVideoContext();
  const { connect: chatConnect } = useChatContext();

  // Seed the spinner synchronously on first render so the lobby never flashes.
  const [isRejoining, setIsRejoining] = useState(() => Boolean(getResumableSession(urlRoomName)));
  const hasStarted = useRef(false);
  const retriedRef = useRef(false);
  const disposedRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  // Set when a genuine token rejection has already been handled by a catch block below.
  // getToken both setError()s AND rejects, so after the catch clears the session, the app
  // error state flips truthy and would trigger the error-watcher's retry/dismiss path. This
  // flag tells the watcher to leave the ErrorDialog up instead of auto-dismissing it.
  const tokenRejectedRef = useRef(false);

  // The retry runs after a delay, so it must call the CURRENT connect/token functions
  // (videoConnect closes over the freshly acquired localTracks). A ref kept up to date each
  // render avoids the delayed retry firing with a stale closure.
  const connectorsRef = useRef({ getToken, videoConnect, chatConnect, removeLocalAudioTrack, removeLocalVideoTrack });
  useEffect(() => {
    connectorsRef.current = { getToken, videoConnect, chatConnect, removeLocalAudioTrack, removeLocalVideoTrack };
  });

  // Media is acquired BEFORE the token request, so every path that gives up and falls back
  // to the lobby must release it — the lobby's first step renders no media UI, and leaked
  // tracks keep the camera/mic "in use" indicator on. DeviceSelectionScreen re-acquires
  // when the user joins manually again.
  const releaseLocalTracks = () => {
    connectorsRef.current.removeLocalAudioTrack();
    connectorsRef.current.removeLocalVideoTrack();
  };

  // The token/video/chat connect sequence. Callable more than once (the retry reuses it).
  // Media acquisition runs only once, before the first attempt, so it is NOT in here.
  const connectSequence = async (session: RejoinSession) => {
    if (disposedRef.current) return;
    const connectors = connectorsRef.current;
    const { token } = await connectors.getToken(session.identity, session.roomName);
    if (disposedRef.current) return;
    await connectors.videoConnect(token);
    if (!featureFlags.isConversationsDisabled()) {
      connectors.chatConnect(token);
    }
    // On success the Room mounts and this component unmounts; no state update needed.
  };

  // React to an SDK-level connect failure surfaced through the app error state. The first
  // failure triggers one retry; a second failure falls back to the lobby (session preserved).
  useEffect(() => {
    if (!error || !hasStarted.current) return;

    // A genuine token rejection (room closed / passcode expired) was already handled by a
    // catch block: the session is cleared and the ErrorDialog is up by design. Do NOT treat
    // it as an SDK resolve-with-error to retry, and do NOT dismiss the dialog the user needs.
    if (tokenRejectedRef.current) return;

    if (!retriedRef.current) {
      retriedRef.current = true;
      console.warn('Auto-rejoin: connect failed, retrying once.', error);
      setError(null); // dismiss the error dialog before retrying
      const session = getResumableSession(urlRoomName);
      retryTimerRef.current = window.setTimeout(() => {
        if (session) {
          connectSequence(session).catch(retryError => {
            // A token rejection on the retry is a genuine refusal; clear and fall back.
            console.warn('Auto-rejoin: retry token request failed.', retryError);
            tokenRejectedRef.current = true;
            clearRejoinSession();
            releaseLocalTracks();
            setIsRejoining(false);
          });
        }
      }, RETRY_DELAY_MS);
      return;
    }

    // Second failure → give up, drop to the lobby, but DO NOT clear the session (Bug 2).
    console.warn('Auto-rejoin: connect failed again, falling back to lobby.', error);
    releaseLocalTracks();
    setIsRejoining(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (hasStarted.current) return;

    const session = getResumableSession(urlRoomName);
    if (!session) {
      setIsRejoining(false);
      return;
    }

    hasStarted.current = true;
    setIsRejoining(true);

    (async () => {
      try {
        // Mirror the manual join flow: a media error doesn't block joining the room.
        await getAudioAndVideoTracks();
      } catch (mediaError) {
        console.warn('Auto-rejoin: could not acquire local media, joining without it.', mediaError);
      }

      try {
        await connectSequence(session);
      } catch (connectError) {
        // Token/connect failed (e.g. expired passcode / closed room). This is a genuine
        // refusal, not transient — drop the stale session and fall back to the lobby so the
        // user can rejoin manually. getToken already surfaces the error through the dialog.
        console.warn('Auto-rejoin: token request failed, falling back to lobby.', connectError);
        tokenRejectedRef.current = true;
        clearRejoinSession();
        releaseLocalTracks();
        setIsRejoining(false);
      }
    })();
    // Run once on mount; the guard ref prevents re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear any pending retry timer and block late callbacks on unmount.
  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  return isRejoining;
}
