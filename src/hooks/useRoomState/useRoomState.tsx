import useVideoContext from '../useVideoContext/useVideoContext';
import useEmitterState from '../useEmitterState/useEmitterState';

type RoomStateType = 'disconnected' | 'connected' | 'reconnecting';

export default function useRoomState() {
  const { room } = useVideoContext();
  const readState = (currentRoom: typeof room) => (currentRoom ? (currentRoom.state as RoomStateType) : 'disconnected');

  // Starts as 'disconnected' even when a room is already present and is corrected by the
  // first effect — kept from the original hook so consumers see the same first render.
  return useEmitterState<typeof room, RoomStateType>(
    room,
    readState,
    {
      disconnected: readState,
      reconnected: readState,
      reconnecting: readState,
    },
    { initial: 'disconnected' }
  );
}
