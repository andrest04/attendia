import { checkRoomOpen } from './checkRoomOpen';
import { ClassSessionAccess, ClassSessionDraft, createClassSessionAccess } from './classSessionTypes';

export type CreateClassSessionAccessResult =
  | { status: 'created'; access: ClassSessionAccess }
  | { status: 'open'; roomName: string };

/**
 * Create flow of the lobby: the slug of the typed session name is used as is when nobody has
 * that room open. When it IS open we cannot tell client-side whose class it is (the owner
 * coming back, a co-teacher, or a stranger who picked the same name), so inventing a suffixed
 * room would silently drop the owner into a different class. Report it instead and let the
 * teacher choose to join. `null` (inconclusive probe) keeps meaning "proceed", like above.
 */
export async function createClassSessionAccessUnlessOpen(
  draft: ClassSessionDraft,
  origin: string,
  search: string = ''
): Promise<CreateClassSessionAccessResult> {
  const access = createClassSessionAccess(draft, origin, search);
  if ((await checkRoomOpen(access.roomName)) === true) {
    return { status: 'open', roomName: access.roomName };
  }
  return { status: 'created', access };
}
