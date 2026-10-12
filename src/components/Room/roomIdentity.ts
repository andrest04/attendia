/** Returns up to 2 uppercase initials from an identity string (first + last word, bracketed suffix ignored). */
export function getInitials(identity: string): string {
  const parts = identity
    .replace(/\[.*?\]/g, '')
    .trim()
    .split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
