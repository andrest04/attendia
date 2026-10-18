/**
 * Facade over `fetch` for the authenticated REST API.
 *
 * Every endpoint call used to repeat the same four steps by hand: get an ID token, build
 * the `Authorization` header, call `fetch`, turn a non-OK response into a typed error.
 * This module owns those steps once; each endpoint is now a one-liner that only names the
 * path, method and body.
 *
 * The `fetch` init objects it produces are deliberately minimal (plain-object headers, no
 * `method` key on a GET, `Idempotency-Key` & co. passed through verbatim) because tests —
 * and the server — depend on their exact shape.
 */

const ClientApiErrorBase = Error as new (message?: string) => { name: string; message: string; stack?: string };

export class ClientApiError extends ClientApiErrorBase {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    Object.setPrototypeOf(this, ClientApiError.prototype);
  }
}

// Statuses the server answers the same way on every retry: malformed, forbidden (e.g. a
// report for a class this teacher does not own), unknown, or too large. 401 is excluded on
// purpose: the ID token may simply have expired and will refresh.
const PERMANENT_CLIENT_ERROR_STATUSES = [400, 403, 404, 413];

/** Whether retrying the same request can never succeed (network errors and 5xx can). */
export function isPermanentClientError(error: unknown): boolean {
  return error instanceof ClientApiError && PERMANENT_CLIENT_ERROR_STATUSES.indexOf(error.status) !== -1;
}

/** Turns a non-OK response into a ClientApiError carrying the server's Spanish explanation. */
export async function throwOnErrorResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  const code = body.error?.message || response.statusText || `http_${response.status}`;
  throw new ClientApiError(response.status, code, body.error?.explanation || code);
}

/** The slice of a Firebase `User` the client needs. */
export interface IdTokenSource {
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

export interface ApiRequestOptions {
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Serialized as the JSON body, with the matching content-type header. */
  json?: unknown;
  /** A raw body (e.g. FormData); the browser sets its own content-type. */
  body?: BodyInit;
  /** Extra headers, e.g. `Idempotency-Key`. */
  headers?: { [name: string]: string };
  /** Bypass the cached ID token (used right after an email change). */
  forceRefresh?: boolean;
}

export interface ApiClient {
  /** Authenticated fetch that returns the response untouched (the caller inspects the status). */
  raw(path: string, options?: ApiRequestOptions): Promise<Response>;
  /** Authenticated fetch that throws a ClientApiError on any non-OK response. */
  request(path: string, options?: ApiRequestOptions): Promise<Response>;
  json<T = any>(path: string, options?: ApiRequestOptions): Promise<T>;
  blob(path: string, options?: ApiRequestOptions): Promise<Blob>;
  /** For endpoints whose success body is ignored. */
  send(path: string, options?: ApiRequestOptions): Promise<void>;
}

export function createApiClient(user: IdTokenSource): ApiClient {
  async function raw(path: string, options: ApiRequestOptions = {}): Promise<Response> {
    const idToken = options.forceRefresh ? await user.getIdToken(true) : await user.getIdToken();

    const headers: { [name: string]: string } = { Authorization: idToken };
    if (options.json !== undefined) headers['content-type'] = 'application/json';
    Object.assign(headers, options.headers);

    const init: RequestInit = { headers };
    if (options.method) init.method = options.method;
    if (options.json !== undefined) init.body = JSON.stringify(options.json);
    else if (options.body !== undefined) init.body = options.body;

    return fetch(path, init);
  }

  async function request(path: string, options?: ApiRequestOptions): Promise<Response> {
    const response = await raw(path, options);
    await throwOnErrorResponse(response);
    return response;
  }

  return {
    raw,
    request,
    json: async (path, options) => (await request(path, options)).json(),
    blob: async (path, options) => (await request(path, options)).blob(),
    send: async (path, options) => {
      await request(path, options);
    },
  };
}

/**
 * Binds an endpoint call to the signed-in user: with no user the returned function
 * rejects with `message` instead of ever touching the network. Replaces the
 * `if (!user) return Promise.reject(new Error(...))` guard that every callback repeated.
 */
export function withUser<U extends IdTokenSource, Args extends any[], Result>(
  user: U | null,
  message: string,
  call: (user: U, ...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result> {
  return (...args: Args) => (user ? call(user, ...args) : Promise.reject(new Error(message)));
}
