import { useEffect, useState } from 'react';
import { RemoteParticipant, Room } from 'twilio-video';

/**
 * Every identity that has ever joined the Twilio Room, for as long as this Room is connected —
 * the cumulative attendance roster a report needs even for students who never produced a single
 * measured CV sample (mobile/unsupported, camera off the whole time, or the pipeline disabled).
 *
 * It never shrinks: a student who leaves stays counted, and a rejoin under the same identity is
 * a no-op (no double count, and no re-render). It resets when the room itself goes away.
 * `restored` (identities from a snapshot restored by the owner teacher) joins the roster too.
 */
export default function useAttendanceRoster(
  room: Room | null | undefined,
  restored: ReadonlySet<string> | null = null
): ReadonlySet<string> {
  const [attended, setAttended] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setAttended(new Set(room ? Array.from(room.participants.values(), participant => participant.identity) : []));
    if (!room) return;

    const handleConnected = (participant: RemoteParticipant) =>
      setAttended(previous =>
        previous.has(participant.identity) ? previous : new Set(previous).add(participant.identity)
      );
    room.on('participantConnected', handleConnected);
    // Intentionally no participantDisconnected handler — the roster must never shrink.
    return () => {
      room.off('participantConnected', handleConnected);
    };
  }, [room]);

  useEffect(() => {
    if (!restored) return;
    setAttended(previous => {
      const missing = Array.from(restored).filter(identity => !previous.has(identity));
      return missing.length === 0 ? previous : new Set([...Array.from(previous), ...missing]);
    });
  }, [restored]);

  return attended;
}
