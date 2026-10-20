import { useMemo } from 'react';
import { useAppState } from '../../state';
import { createApiClient } from '../../state/useFirebaseAuth/apiClient';
import useAsyncResource from '../useAsyncResource/useAsyncResource';
import useVideoContext from '../useVideoContext/useVideoContext';

export type RoomOwnerStatus = 'owner' | 'co-teacher' | 'unknown';

/**
 * Asks the token server once per room whether the signed-in teacher is the room's owner or a
 * co-teacher (GET /rooms/:roomName/ownership). Owner-only UI (end for everyone, recording, the
 * attention report) must hide ONLY on a confirmed 'co-teacher': while the lookup is pending or
 * after it failed the status is 'unknown' and callers behave as the owner, because the server
 * refuses the owner-only actions anyway and a failed lookup must never take the owner's controls
 * away. Pass `enabled=false` (students) to skip the request.
 */
export default function useIsRoomOwner(enabled: boolean): RoomOwnerStatus {
  const { room } = useVideoContext();
  const { user } = useAppState();
  const roomName = room?.name;
  const firebaseUser = user && 'getIdToken' in user ? user : null;

  const load = useMemo(
    () =>
      enabled && roomName && firebaseUser
        ? () =>
            createApiClient(firebaseUser).json<{ isOwner: boolean }>(`/rooms/${encodeURIComponent(roomName)}/ownership`)
        : null,
    [enabled, roomName, firebaseUser]
  );

  const { data } = useAsyncResource(load, { failureMessage: 'No pudimos verificar tu rol en la sala.' });
  if (!data || typeof data.isOwner !== 'boolean') return 'unknown';
  return data.isOwner ? 'owner' : 'co-teacher';
}
