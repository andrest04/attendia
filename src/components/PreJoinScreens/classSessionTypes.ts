export type ClassSessionRole = 'teacher' | 'student';

export type MonitoringSensitivity = 'low' | 'medium' | 'high';

export interface ClassSessionDraft {
  role: ClassSessionRole;
  displayName: string;
  sessionName: string;
  recordingEnabled: boolean;
  monitoringSensitivity: MonitoringSensitivity;
}

export interface ClassSessionAccess {
  joinCode: string;
  joinLink: string;
  roomName: string;
}

const FALLBACK_ROOM_NAME = 'class-session';
const TEACHER_DISPLAY_SUFFIX = '[Profesor]';

export function createDefaultClassSessionDraft(displayName = ''): ClassSessionDraft {
  return {
    role: 'teacher',
    displayName,
    sessionName: '',
    recordingEnabled: false,
    monitoringSensitivity: 'medium',
  };
}

export function toClassSessionRoomName(sessionName: string): string {
  const asciiValue = sessionName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return asciiValue || FALLBACK_ROOM_NAME;
}

export function isClassSessionDraftReady(draft: ClassSessionDraft): boolean {
  return Boolean(draft.displayName.trim() && draft.sessionName.trim() && draft.monitoringSensitivity);
}

export function createClassSessionAccess(
  draft: ClassSessionDraft,
  origin: string,
  search: string = ''
): ClassSessionAccess {
  const roomName = toClassSessionRoomName(draft.sessionName);
  return {
    roomName,
    joinCode: roomName,
    joinLink: `${origin}/room/${window.encodeURIComponent(roomName)}${search || ''}`,
  };
}

export function isTeacherIdentity(identity: string | null | undefined): boolean {
  if (!identity) return false;
  return identity
    .trim()
    .toLowerCase()
    .endsWith(TEACHER_DISPLAY_SUFFIX.toLowerCase());
}

export function toClassSessionDisplayName(name: string, role: ClassSessionRole): string {
  const trimmedName = name.trim();

  if (!trimmedName) return '';
  if (role !== 'teacher') return trimmedName;

  const normalizedSuffix = TEACHER_DISPLAY_SUFFIX.toLowerCase();
  if (trimmedName.toLowerCase().endsWith(normalizedSuffix)) {
    return trimmedName;
  }

  return `${trimmedName} ${TEACHER_DISPLAY_SUFFIX}`;
}

export function normalizeStudentJoinInputToRoomName(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) return '';

  const readRoomSegment = (value: string) => {
    const match = value.match(/(?:^|\/)room\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).trim() : '';
  };

  const roomFromPath = readRoomSegment(trimmedInput);
  if (roomFromPath) return roomFromPath;

  try {
    const parsed = new URL(trimmedInput);
    const roomFromUrlPath = readRoomSegment(parsed.pathname);
    if (roomFromUrlPath) return roomFromUrlPath;
  } catch (error) {
    void error;
  }

  return decodeURIComponent(trimmedInput.split(/[?#]/)[0]).trim();
}
