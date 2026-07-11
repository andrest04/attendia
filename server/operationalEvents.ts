import { RequestHandler } from 'express';

export interface OperationalFailure {
  event: string;
  operation: string;
  uid?: string;
  classId?: string;
  roomSid?: string;
  error: unknown;
}

/**
 * Emits one machine-readable event to the server's process log. This repository
 * has no hosted alerting SDK; deployment must collect these logs and alert on
 * `operational_failure` events.
 */
export function logOperationalFailure({ event, operation, uid, classId, roomSid, error }: OperationalFailure): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'operational_failure',
      operation,
      failure: event,
      uid,
      classId,
      roomSid,
      message,
    })
  );
}

// The browser sends only an operation and Firebase error code. The verified uid is
// attached by middleware here so credentials and requested email addresses never enter logs.
export const createClientOperationalEventHandler = (): RequestHandler => (req, res) => {
  const operation = typeof req.body?.operation === 'string' ? req.body.operation : '';
  const failure = typeof req.body?.failure === 'string' ? req.body.failure : '';
  const uid = res.locals?.firebaseUser?.uid;
  if (!operation || operation.length > 100 || !failure || failure.length > 100 || typeof uid !== 'string') {
    res.status(400).send();
    return;
  }
  logOperationalFailure({ event: 'client_profile_failure', operation, uid, error: failure });
  res.status(204).send();
};
