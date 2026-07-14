/*
 * Storage-agnostic port for converting an office document to PDF for inline preview.
 * Mirrors the FileStorage port (fileStorage.ts): resources.ts programs against this
 * interface, and gotenbergDocumentConverter.ts is the only file allowed to know about
 * the Gotenberg HTTP API, so the backend can be swapped (or faked in tests) without
 * touching handler code.
 */

export interface DocumentConverter {
  // fileName must keep its original extension (e.g. "guia.pptx") — the converter
  // backend picks its import filter (Word vs PowerPoint) from it.
  convertToPdf(buffer: Buffer, fileName: string): Promise<Buffer>;
}
