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

const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
]);

// Hint for the <input type="file"> accept attribute, so the OS file picker
// itself filters out unsupported files (extensions + MIME types together for
// broadest picker compatibility). This narrows what's easy to pick, but a
// user can still override the picker's filter or drag-drop anything — the
// real gate is validateResourceFile() below plus the server re-check.
export const RESOURCE_FILE_ACCEPT = [
  '.pdf',
  'application/pdf',
  '.ppt',
  '.pptx',
  '.odp',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
  '.doc',
  '.docx',
  '.odt',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  '.zip',
  'application/zip',
  'application/x-zip-compressed',
  'video/*',
].join(',');

function isSupportedResourceMimeType(mimetype: string): boolean {
  return (
    mimetype === 'application/pdf' ||
    PRESENTATION_MIME_TYPES.has(mimetype) ||
    WORD_MIME_TYPES.has(mimetype) ||
    ZIP_MIME_TYPES.has(mimetype) ||
    mimetype.startsWith('video/')
  );
}

/** Returns a user-facing Spanish error, or null if the file is upload-eligible. */
export function validateResourceFile(file: File): string | null {
  if (file.size > MAX_RESOURCE_FILE_SIZE_BYTES) {
    return 'El archivo supera el tamaño máximo permitido (25 MB).';
  }
  if (!isSupportedResourceMimeType(file.type)) {
    return 'Tipo de archivo no admitido. Solo se aceptan PDFs, presentaciones, documentos de Word, archivos ZIP y videos.';
  }
  return null;
}
