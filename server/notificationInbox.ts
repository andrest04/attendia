import { effectivelyUnread } from './firestoreTime';

/**
 * Facade over the notification inbox's Firestore layout:
 *
 *   users/{uid}/notificationState/inbox                      → { currentGeneration, unreadCount, readBefore, … }
 *   users/{uid}/notificationGenerations/{generation}/items/* → one doc per canonical notification
 *
 * classes.ts (cancel a class), attentionReports.ts (a failed report recovers) and the
 * reconciler all need to locate the current generation and to retract items while
 * keeping `unreadCount` consistent. Each used to re-derive both inline, including the
 * `Number.isSafeInteger(x) ? x : 0` guards and the unread arithmetic.
 *
 * The types below are deliberately minimal and generic over the caller's document
 * reference type: every route module models Firestore with its own narrow structural
 * slice (ClassDocumentReference, ReportDocumentReference, Document, …) and each of
 * them satisfies `InboxRef` structurally, so no `as any` bridging is needed.
 *
 * Firestore transactions require every read before any write, so the API is split in
 * two phases: `readInbox` / `readInboxItems` (reads) and `retractInboxItems` (writes).
 */
type Data = { [key: string]: any };

export interface InboxSnapshot {
  // Optional because some route modules type their snapshots loosely; absent means "not found".
  exists?: boolean;
  data(): Data | undefined;
}

export interface InboxRef<Ref> {
  collection(name: string): { doc(id: string): Ref };
}

export interface InboxTransaction<Ref> {
  get(ref: Ref): Promise<InboxSnapshot>;
  update(ref: Ref, data: Data): unknown;
  delete(ref: Ref): unknown;
}

export interface Inbox<Ref> {
  stateRef: Ref;
  stateSnapshot: InboxSnapshot;
  state: Data;
  generation: number;
  /** Reference to an item of the CURRENT generation. */
  itemRef(notificationId: string): Ref;
}

export interface InboxItemRead<Ref> {
  ref: Ref;
  snapshot: InboxSnapshot;
}

/** The current generation of an inbox state document (0 when absent or malformed). */
export function inboxGeneration(state: Data): number {
  return Number.isSafeInteger(state.currentGeneration) ? state.currentGeneration : 0;
}

/** The stored unread counter (0 when absent or malformed). */
export function inboxUnreadCount(state: Data): number {
  return Number.isSafeInteger(state.unreadCount) ? state.unreadCount : 0;
}

/** Read phase: loads the inbox state document and resolves the current generation. */
export async function readInbox<Ref extends InboxRef<Ref>>(
  transaction: InboxTransaction<Ref>,
  userRef: InboxRef<Ref>
): Promise<Inbox<Ref>> {
  const stateRef = userRef.collection('notificationState').doc('inbox');
  const stateSnapshot = await transaction.get(stateRef);
  const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
  const generation = inboxGeneration(state);
  const items = userRef.collection('notificationGenerations').doc(String(generation)).collection('items');
  return { stateRef, stateSnapshot, state, generation, itemRef: id => items.doc(id) };
}

/** Read phase: loads the given items of the current generation, in order. */
export async function readInboxItems<Ref extends InboxRef<Ref>>(
  transaction: InboxTransaction<Ref>,
  inbox: Inbox<Ref>,
  notificationIds: string[]
): Promise<Array<InboxItemRead<Ref>>> {
  const reads: Array<InboxItemRead<Ref>> = [];
  for (const id of notificationIds) {
    const ref = inbox.itemRef(id);
    reads.push({ ref, snapshot: await transaction.get(ref) });
  }
  return reads;
}

/**
 * Write phase: deletes every item that exists and lowers `unreadCount` by the number of
 * those that were still effectively unread (never below 0). Returns how many items it
 * removed. The counter is only written when the state document already exists, matching
 * the original per-module behavior.
 */
export function retractInboxItems<Ref>(
  transaction: InboxTransaction<Ref>,
  inbox: Inbox<Ref>,
  items: Array<InboxItemRead<Ref>>
): number {
  let removed = 0;
  let unreadDelta = 0;
  for (const { ref, snapshot } of items) {
    if (!snapshot.exists) continue;
    if (effectivelyUnread(snapshot.data() || {}, inbox.state.readBefore)) unreadDelta++;
    transaction.delete(ref);
    removed++;
  }
  if (unreadDelta > 0 && inbox.stateSnapshot.exists) {
    transaction.update(inbox.stateRef, {
      unreadCount: Math.max(0, inboxUnreadCount(inbox.state) - unreadDelta),
    });
  }
  return removed;
}
