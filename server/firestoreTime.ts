/**
 * Shared Firestore time helpers. Firestore hands back `Timestamp` objects (with
 * `toMillis()`); tests and some callers pass plain `Date`s. Every server module that
 * compares notification/report timestamps goes through here so the copies cannot
 * drift (they previously did: one ignored `Date` and skipped the finite check).
 */

export function timestampMillis(value: any): number | null {
  if (value instanceof Date) return value.getTime();
  if (!value || typeof value.toMillis !== 'function') return null;
  const result = value.toMillis();
  return Number.isFinite(result) ? result : null;
}

/**
 * An inbox item is unread unless it has an explicit `readAt`, or it was created at or
 * before the owner's "read everything before" boundary.
 */
export function effectivelyUnread(item: { [key: string]: any }, readBefore: unknown): boolean {
  const createdAt = timestampMillis(item.createdAt);
  const boundary = timestampMillis(readBefore);
  return timestampMillis(item.readAt) === null && !(boundary !== null && createdAt !== null && createdAt <= boundary);
}
