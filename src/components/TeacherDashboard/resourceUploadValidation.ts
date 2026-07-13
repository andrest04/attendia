/*
 * Client-side mirror of the upload rules enforced server-side in
 * server/resources.ts (MAX_FILE_SIZE_BYTES, PRESENTATION_MIME_TYPES,
 * WORD_MIME_TYPES, resolveKind). Same duplication pattern as
 * isTeacherIdentity/server/roomAccessGuard.ts — no shared module between
 * client and server, so keep these two in sync by hand.
 *
 * This lets ResourcesTab reject an oversized or unsupported file immediately,
 * before spending the time/bandwidth to upload it and get a 400 back. The
 * server remains the source of truth and re-validates independently.
 */

export const MAX_RESOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// A single file-picker selection larger than this is rejected outright (no
// partial upload of "the first N") so the teacher isn't surprised by which
// files silently made it through.
export const MAX_FILES_PER_UPLOAD = 10;

const PRESENTATION_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.presentation',
]);

const WORD_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
]);

function isSupportedResourceMimeType(mimetype: string): boolean {
  return (
    mimetype === 'application/pdf' ||
    PRESENTATION_MIME_TYPES.has(mimetype) ||
    WORD_MIME_TYPES.has(mimetype) ||
    mimetype.startsWith('video/')
  );
}

/** Returns a user-facing Spanish error, or null if the file is upload-eligible. */
export function validateResourceFile(file: File): string | null {
  if (file.size > MAX_RESOURCE_FILE_SIZE_BYTES) {
    return 'El archivo supera el tamaño máximo permitido (25 MB).';
  }
  if (!isSupportedResourceMimeType(file.type)) {
    return 'Tipo de archivo no admitido. Solo se aceptan PDFs, presentaciones, documentos de Word y videos.';
  }
  return null;
}
