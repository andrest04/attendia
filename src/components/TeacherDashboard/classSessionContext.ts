export interface ScheduledClassSessionContext {
  classId: string;
  roomName: string;
}

const STORAGE_KEY = 'twilio-video-scheduled-class-context';

export function saveScheduledClassSession(context: ScheduledClassSessionContext): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {}
}

export function readScheduledClassSession(roomName: string): ScheduledClassSessionContext | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
    return value && value.roomName === roomName && typeof value.classId === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function clearScheduledClassSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
