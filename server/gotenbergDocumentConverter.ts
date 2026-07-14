import { DocumentConverter } from './documentConverter';

/*
 * Calls a Gotenberg instance (https://gotenberg.dev, self-hosted Docker image with
 * LibreOffice baked in) over HTTP instead of shelling out to a local `soffice`
 * binary. This means neither developer machines nor the app's own runtime image need
 * LibreOffice installed — just a Gotenberg container reachable at GOTENBERG_URL
 * (locally: `docker run --rm -p 3010:3000 gotenberg/gotenberg:8`; in production, its
 * own deployed service). No file bytes leave our infrastructure either way.
 */

/** Returns a converter that always rejects when Gotenberg isn't configured, so a missing env var fails one preview request instead of crashing the whole server at boot. */
export function createGotenbergDocumentConverter(baseUrl: string | undefined): DocumentConverter {
  return {
    async convertToPdf(buffer: Buffer, fileName: string): Promise<Buffer> {
      if (!baseUrl) {
        throw new Error('GOTENBERG_URL is not configured');
      }

      const form = new FormData();
      form.append('files', new Blob([buffer]), fileName);

      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/forms/libreoffice/convert`, {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        throw new Error(`Gotenberg conversion failed with status ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
  };
}
