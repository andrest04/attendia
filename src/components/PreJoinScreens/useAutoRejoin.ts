import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../state';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { clearRejoinSession, getResumableSession } from './rejoinSession';

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
 */
export default function useAutoRejoin(urlRoomName: string | undefined): boolean {
  const { getToken, error } = useAppState();
  const { connect: videoConnect, getAudioAndVideoTracks } = useVideoContext();
  const { connect: chatConnect } = useChatContext();

  // Seed the spinner synchronously on first render so the lobby never flashes.
  const [isRejoining, setIsRejoining] = useState(() => Boolean(getResumableSession(urlRoomName)));
  const hasStarted = useRef(false);

  // `useRoom`'s connect resolves (not rejects) on an SDK-level failure and surfaces the
  // problem through the app error state instead. So if an error appears once a rejoin is
  // underway, drop back to the lobby rather than leaving the spinner stuck behind the dialog.
  useEffect(() => {
    if (error && hasStarted.current) {
      clearRejoinSession();
      setIsRejoining(false);
    }
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
        const { token } = await getToken(session.identity, session.roomName);
        await videoConnect(token);
        if (process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS !== 'true') {
          chatConnect(token);
        }
        // On success the Room mounts and this component unmounts; no state update needed.
      } catch {
        // Token/connect failed (e.g. expired passcode). Drop the stale session and
        // fall back to the lobby so the user can rejoin manually. getToken already
        // surfaces the error through the app-level ErrorDialog.
        clearRejoinSession();
        setIsRejoining(false);
      }
    })();
    // Run once on mount; the guard ref prevents re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isRejoining;
}
