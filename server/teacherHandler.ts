import { NextFunction, RequestHandler } from 'express';
import { ExpressRequest, ExpressResponse, getVerifiedUser, sendError, sendTeacherOnly } from './http';
import { logOperationalFailure } from './operationalEvents';
import { resolveIsTeacher, TeacherAuthorizationDatabase } from './teacherAuthorization';

/**
 * Template Method for every "verified teacher only" REST endpoint.
 *
 * The fixed skeleton is: verified Firebase user (else 401) → optional request
 * pre-validation → teacher role lookup in Firestore (else 403) → endpoint-specific
 * `work` → any thrown error is logged as an operational failure and answered with the
 * endpoint's own 503. Each route module supplies only the parts that differ (copy,
 * event names, the work itself), instead of re-implementing the skeleton per handler.
 *
 * The role lookup deliberately lives INSIDE the try/catch, so a Firestore outage during
 * the lookup yields the endpoint's own 503 rather than an unhandled rejection.
 */
export interface TeacherHandlerContext {
  uid: string;
  req: ExpressRequest;
  res: ExpressResponse;
  /** Lets a teacher-only MIDDLEWARE (e.g. the /recordingrules ownership gate) pass on. */
  next: NextFunction;
}

export interface TeacherHandlerOptions {
  /** Spanish explanation sent with the 403 when the caller is not a teacher. */
  forbiddenExplanation: string;
  /** Machine message of that 403; defaults to 'teacher role required'. */
  forbiddenMessage?: string;
  /** Operational-failure event + the 503 body used when `work` (or the lookup) throws. */
  failure: { event: string; operation: string; message: string; explanation: string };
  /**
   * Runs after the 401 check and BEFORE the role lookup, so a malformed request keeps
   * answering 400 even for a non-teacher. Return false once it has already responded.
   */
  preValidate?: (req: ExpressRequest, res: ExpressResponse) => boolean;
  /** Extra identifiers attached to the operational-failure log line. */
  logContext?: (req: ExpressRequest) => { classId?: string; roomSid?: string };
  /** Maps a known error (e.g. a typed 404/409) to its own response. Return true once it responded. */
  mapError?: (error: unknown, res: ExpressResponse) => boolean;
}

export function teacherHandler(
  db: TeacherAuthorizationDatabase,
  options: TeacherHandlerOptions,
  work: (context: TeacherHandlerContext) => Promise<void>
): RequestHandler {
  return async (req, res, next) => {
    const firebaseUser = getVerifiedUser(res);
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    if (options.preValidate && !options.preValidate(req, res)) return;

    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        if (options.forbiddenMessage) sendError(res, 403, options.forbiddenMessage, options.forbiddenExplanation);
        else sendTeacherOnly(res, options.forbiddenExplanation);
        return;
      }
      await work({ uid: firebaseUser.uid, req, res, next });
    } catch (error) {
      if (options.mapError && options.mapError(error, res)) return;
      const { event, operation, message, explanation } = options.failure;
      logOperationalFailure({
        event,
        operation,
        uid: firebaseUser.uid,
        ...(options.logContext ? options.logContext(req) : {}),
        error,
      });
      sendError(res, 503, message, explanation);
    }
  };
}

/**
 * The same 401 → teacher role lookup → 403 / 503 skeleton as a pass-through middleware,
 * for routes that must refuse a non-teacher BEFORE an expensive step runs — e.g. mounted
 * ahead of multer so a student's 25 MB upload is never buffered into memory. The route's
 * own handler may keep its role check as defense in depth.
 */
export function createTeacherGate(
  db: TeacherAuthorizationDatabase,
  options: Pick<TeacherHandlerOptions, 'forbiddenExplanation' | 'forbiddenMessage' | 'failure'>
): RequestHandler {
  return teacherHandler(db, options, async ({ next }) => next());
}
