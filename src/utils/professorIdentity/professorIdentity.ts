/** Up to 2 uppercase initials from a full name (first + last word). */
export function getProfessorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Resolves which photo (if any) should represent the user: an uploaded avatar wins,
 * otherwise the auth provider's photo (e.g. Google) — unless the user explicitly
 * removed their photo (`avatarRemoved`), in which case no photo is shown at all,
 * even if the provider still has one on file.
 */
export function resolveProfilePhotoURL(
  avatarUrl: string | null | undefined,
  avatarRemoved: boolean | undefined,
  providerPhotoURL: string | null | undefined
): string | undefined {
  if (avatarUrl) return avatarUrl;
  if (avatarRemoved) return undefined;
  return providerPhotoURL || undefined;
}
