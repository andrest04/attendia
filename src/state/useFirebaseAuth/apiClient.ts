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

import { acceptLanguageHeader } from '../../i18n/locale';
import { FirebaseError } from 'firebase/app';
import { getCurrentLanguage } from '../../i18n/currentLanguage';
import completeErrorsEn from '../../i18n/locales/completeErrors.en';
import completeErrorsEs from '../../i18n/locales/completeErrors.es';

// The project augments Error with code: undefined; API errors carry a string code instead.
const ClientApiErrorBase: new (message?: string) => Omit<Error, 'code'> = Error;

/** Keep Error's non-enumerable, writable message semantics after an explicit assignment. */
export function setLocalizedErrorMessage(error: Omit<Error, 'code'>, resolve: () => string): void {
  // Materialize the stack before installing the getter: diagnostics contain call sites,
  // not server text captured in a different language.
  void error.stack;
  Object.defineProperty(error, 'message', {
    configurable: true,
    get: resolve,
    set: value => Object.defineProperty(error, 'message', { configurable: true, writable: true, value }),
  });
}

export class ClientApiError extends ClientApiErrorBase {
  constructor(public status: number, public code: string, message: string, public hasServerExplanation = true, sourceLanguage?: string) {
    super();
    Object.setPrototypeOf(this, ClientApiError.prototype);
    setLocalizedErrorMessage(this, () => {
      const english = getCurrentLanguage().split('-')[0] === 'en';
      // Legacy callers supply Spanish explanations; HTTP responses must have known provenance.
      if (!english && (sourceLanguage === undefined || sourceLanguage === 'es') && hasServerExplanation) return message;
      const translations: { [key: string]: string } = english ? completeErrorsEn : completeErrorsEs;
      // The same upload code is used for photos (2 MB) and resources (25 MB).
      if (code === 'file too large') {
        if (message.indexOf('25 MB') !== -1) return translations['file too large:25 MB'];
        if (message.indexOf('2 MB') !== -1) return translations['file too large:2 MB'];
      }
      const statusKey = `${status}:${code}`;
      if (Object.prototype.hasOwnProperty.call(translations, statusKey)) return translations[statusKey];
      return Object.prototype.hasOwnProperty.call(translations, code) ? translations[code] : translations.requestFailed;
    });
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

// Associate responses with the language actually sent, even if the UI changes in flight.
const responseLanguages = new WeakMap<Response, string>();

/** Turns a non-OK response into a localized ClientApiError. */
export async function throwOnErrorResponse(response: Response, requestLanguage?: string): Promise<void> {
  if (response.ok) return;
  const sourceLanguage = responseLanguages.get(response) || requestLanguage || 'unknown';
  const body = await response.json().catch(() => ({}));
  const code = body.error?.message || response.statusText || `http_${response.status}`;
  throw new ClientApiError(response.status, code, body.error?.explanation || code, Boolean(body.error?.explanation), sourceLanguage);
}

/** The slice of a Firebase `User` the client needs. */
export interface IdTokenSource {
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

/** Localize Firebase authentication failures without changing their identity or code. */
export async function acquireIdToken(user: IdTokenSource, forceRefresh = false): Promise<string> {
  try {
    return forceRefresh ? await user.getIdToken(true) : await user.getIdToken();
  } catch (error) {
    if (FirebaseError && error instanceof FirebaseError && error.code.indexOf('auth/') === 0 && error.name !== 'AbortError') {
      try {
        setLocalizedErrorMessage(error, () =>
          getCurrentLanguage().split('-')[0] === 'en' ? completeErrorsEn.tokenFailed : completeErrorsEs.tokenFailed
        );
      } catch {
        // Frozen or otherwise non-configurable errors must retain their original behavior.
      }
    }
    throw error;
  }
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
    const idToken = await acquireIdToken(user, options.forceRefresh);

    const headers: { [name: string]: string } = { Authorization: idToken, ...acceptLanguageHeader() };
    if (options.json !== undefined) headers['content-type'] = 'application/json';
    Object.assign(headers, options.headers);

    const init: RequestInit = { headers };
    if (options.method) init.method = options.method;
    if (options.json !== undefined) init.body = JSON.stringify(options.json);
    else if (options.body !== undefined) init.body = options.body;

    try {
      const response = await fetch(path, init);
      responseLanguages.set(response, headers['Accept-Language'].split('-')[0]);
      return response;
    } catch (error) {
      // Fetch rejects with TypeError for network failures; token acquisition above is separate.
      if (!(error instanceof TypeError) || error.name === 'AbortError') throw error;
      const networkError = new TypeError();
      Object.defineProperty(networkError, 'cause', { configurable: true, value: error });
      setLocalizedErrorMessage(networkError, () =>
        getCurrentLanguage().split('-')[0] === 'en' ? completeErrorsEn.requestFailed : completeErrorsEs.requestFailed
      );
      throw networkError;
    }
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
  call: (user: U, ...args: Args) => Promise<Result>,
  noUserError: () => Error = () => new Error(message)
): (...args: Args) => Promise<Result> {
  return (...args: Args) => (user ? call(user, ...args) : Promise.reject(noUserError()));
}
