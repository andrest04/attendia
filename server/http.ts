import { ErrorRequestHandler, RequestHandler } from 'express';

/**
 * Shared HTTP plumbing for the Firestore-backed route modules. Before this module each
 * of classes/resources/attentionReports/recordings/userProfiles carried its own copy of
 * these helpers.
 */

export type ExpressRequest = Parameters<RequestHandler>[0];
export type ExpressResponse = Parameters<RequestHandler>[1];

// Decoded Firebase identity attached by firebaseAuthMiddleware. Lives in this leaf
// module (no runtime deps) so the middleware and every handler share one type without
// import cycles.
export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

export function getVerifiedUser(res: ExpressResponse): VerifiedFirebaseUser | undefined {
  const firebaseUser = res.locals && res.locals.firebaseUser;
  if (firebaseUser && typeof firebaseUser.uid === 'string' && firebaseUser.uid.length > 0) {
    return firebaseUser as VerifiedFirebaseUser;
  }
  return undefined;
}

export function sendError(res: ExpressResponse, status: number, message: string, explanation: string): void {
  res.status(status).json({ error: { message, explanation } });
}

export function sendBadRequest(res: ExpressResponse, message: string, explanation: string): void {
  sendError(res, 400, message, explanation);
}

export function sendTeacherOnly(res: ExpressResponse, explanation: string): void {
  sendError(res, 403, 'teacher role required', explanation);
}

/**
 * Outcome of parsing a request body. Parsers are pure functions returning this instead
 * of writing to `res`, so validation is unit-testable without a mock response; the
 * handler turns a failure into the 400 via `sendParseError`.
 */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string; explanation: string };

export const parseOk = <T>(value: T): ParseResult<T> => ({ ok: true, value });
export const parseFail = (message: string, explanation: string): ParseResult<never> => ({
  ok: false,
  message,
  explanation,
});

export function sendParseError(res: ExpressResponse, failure: { message: string; explanation: string }): void {
  sendBadRequest(res, failure.message, failure.explanation);
}

/**
 * Typed errors for the cases where a lower layer needs to tell the HTTP layer "this is
 * a 404/409, not a 503". Replaces hanging `.status` off a bare `Error` at each throw
 * site; `HttpError.is(err, 404)` is the matching check.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    // Keep `instanceof` working when targeting ES5-style class emit.
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  static badRequest(message: string): HttpError {
    return new HttpError(400, message);
  }

  static notFound(message: string): HttpError {
    return new HttpError(404, message);
  }

  static conflict(message: string): HttpError {
    return new HttpError(409, message);
  }

  /** True for an `HttpError` with this status, or any error that carries the same `.status`. */
  static is(error: unknown, status: number): boolean {
    return !!error && typeof error === 'object' && (error as { status?: unknown }).status === status;
  }
}

/** multer reports an oversize upload as `LIMIT_FILE_SIZE`; map it to the route's own 400 copy. */
export const createFileSizeLimitErrorHandler = (copy: { message: string; explanation: string }): ErrorRequestHandler => (
  err,
  _req,
  res,
  next
) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    sendBadRequest(res, copy.message, copy.explanation);
    return;
  }
  next(err);
};
