import { DocumentConverter } from './documentConverter';

/*
 * Calls a Gotenberg instance (https://gotenberg.dev, self-hosted Docker image with
 * LibreOffice baked in) over HTTP instead of shelling out to a local `soffice`
 * binary. This means neither developer machines nor the app's own runtime image need
 * LibreOffice installed — just a Gotenberg container reachable at GOTENBERG_URL
 * (locally: `docker run --rm -p 3010:3000 gotenberg/gotenberg:8`; in production, an
 * Attendia sidecar at http://localhost:3000). No file bytes leave our infrastructure
 * either way.
 */

function createTimeoutError(timeoutMs: number): Error {
  const error = new Error(`Gotenberg did not answer within ${timeoutMs} ms`);
  error.name = 'TimeoutError';
  return error;
}

/** Returns a converter that always rejects when Gotenberg isn't configured, so a missing env var fails one preview request instead of crashing the whole server at boot. */
export function createGotenbergDocumentConverter(
  baseUrl: string | undefined,
  retryDelayMs = 500,
  // Per attempt: a hung Gotenberg must not pin the preview request (and its buffer)
  // forever. A timeout is retried like a connection failure.
  attemptTimeoutMs = 60000
): DocumentConverter {
  return {
    async convertToPdf(buffer: Buffer, fileName: string): Promise<Buffer> {
      if (!baseUrl) {
        throw new Error('GOTENBERG_URL is not configured');
      }

      const url = `${baseUrl.replace(/\/+$/, '')}/forms/libreoffice/convert`;
      const maxAttempts = 5;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // An AbortController + timer rather than AbortSignal.timeout(): it also covers
        // reading the body, and it is available in every runtime the tests use (jsdom).
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, attemptTimeoutMs);
        try {
          const form = new FormData();
          form.append('files', new Blob([buffer]), fileName);
          const response = await fetch(url, { method: 'POST', body: form, signal: controller.signal });

          if (response.ok) {
            return Buffer.from(await response.arrayBuffer());
          }

          // Bad input is a permanent conversion failure. Only retry gateway-style
          // responses, which can occur while the sidecar finishes starting.
          if (![502, 503, 504].includes(response.status) || attempt === maxAttempts) {
            throw new Error(`Gotenberg conversion failed with status ${response.status}`);
          }
          console.warn(`Gotenberg is not ready (status ${response.status}); retrying preview (${attempt}/${maxAttempts})`);
        } catch (caught) {
          const error = timedOut ? createTimeoutError(attemptTimeoutMs) : caught;
          if (attempt === maxAttempts) throw error;
          if (error instanceof Error && /^Gotenberg conversion failed with status /.test(error.message)) throw error;
          console.warn(`Gotenberg connection failed; retrying preview (${attempt}/${maxAttempts})`, error);
        } finally {
          clearTimeout(timer);
        }

        await new Promise(resolve => setTimeout(resolve, retryDelayMs * 2 ** (attempt - 1)));
      }

      throw new Error('Gotenberg conversion failed unexpectedly');
    },
  };
}
