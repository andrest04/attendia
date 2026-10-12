import { createStorageSlot } from '../../utils/createStorageSlot';

export interface ScheduledClassSessionContext {
  classId: string;
  roomName: string;
}

const slot = createStorageSlot<ScheduledClassSessionContext>({
  key: 'twilio-video-scheduled-class-context',
  parse: stored => {
    const value = stored as Partial<ScheduledClassSessionContext> | null;
    return value && typeof value.roomName === 'string' && typeof value.classId === 'string'
      ? (value as ScheduledClassSessionContext)
      : null;
  },
});

export const saveScheduledClassSession = (context: ScheduledClassSessionContext): void => slot.write(context);

/** The context of the class being started, but only when it belongs to the room being joined. */
export function readScheduledClassSession(roomName: string): ScheduledClassSessionContext | null {
  const value = slot.read();
  return value && value.roomName === roomName ? value : null;
}

export const clearScheduledClassSession = (): void => slot.clear();
