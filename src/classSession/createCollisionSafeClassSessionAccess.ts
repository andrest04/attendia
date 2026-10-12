import { checkRoomOpen } from './checkRoomOpen';
import { ClassSessionAccess, ClassSessionDraft, createClassSessionAccess } from './classSessionTypes';

const MAX_DISAMBIGUATION_ATTEMPTS = 5;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Quick-start teacher sessions never persist a class doc (unlike scheduled classes,
 * which get a docId-derived disambiguating suffix server-side — see server/classes.ts
 * buildRoomName), so two teachers quick-starting a session with the same name would
 * otherwise silently land in the same Twilio room. checkRoomOpen is a best-effort probe
 * (see its own doc comment): only a confirmed `true` counts as a collision — `false` and
 * `null` (inconclusive) both mean "proceed with this name", matching how the student join
 * path already treats this same probe.
 */
export async function resolveCollisionSafeRoomName(baseRoomName: string): Promise<string> {
  let candidate = baseRoomName;
  for (let attempt = 0; attempt < MAX_DISAMBIGUATION_ATTEMPTS; attempt++) {
    if ((await checkRoomOpen(candidate)) !== true) return candidate;
    candidate = `${baseRoomName}-${randomSuffix()}`;
  }
  return candidate;
}

export async function createCollisionSafeClassSessionAccess(
  draft: ClassSessionDraft,
  origin: string,
  search: string = ''
): Promise<ClassSessionAccess> {
  const access = createClassSessionAccess(draft, origin, search);
  const roomName = await resolveCollisionSafeRoomName(access.roomName);
  if (roomName === access.roomName) return access;
  return {
    roomName,
    joinCode: roomName,
    joinLink: `${origin}/room/${window.encodeURIComponent(roomName)}${search || ''}`,
  };
}
