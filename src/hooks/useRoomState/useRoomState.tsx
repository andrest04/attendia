import { useEffect, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';

type RoomStateType = 'disconnected' | 'connected' | 'reconnecting';

export default function useRoomState() {
  const { room } = useVideoContext();
  const [state, setState] = useState<RoomStateType>('disconnected');

  useEffect(() => {
    const setRoomState = () => setState(room ? (room.state as RoomStateType) : 'disconnected');
    setRoomState();
    if (room) {
      room
        .on('disconnected', setRoomState)
        .on('reconnected', setRoomState)
        .on('reconnecting', setRoomState);
    }
    return () => {
      if (room) {
        room
          .off('disconnected', setRoomState)
          .off('reconnected', setRoomState)
          .off('reconnecting', setRoomState);
      }
    };
  }, [room]);

  return state;
}
