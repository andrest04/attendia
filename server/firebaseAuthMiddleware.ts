import { RequestHandler } from 'express';
import { VerifiedFirebaseUser } from './http';

/*
 * Authentication-only middleware: verifies the Firebase ID token from the
 * Authorization header and attaches the decoded identity (uid, email) to
 * res.locals.firebaseUser for downstream handlers (e.g. the profile endpoints).
 *
 * Registration is open, so there is deliberately NO allowlist gate here anymore
 * (the old @twilio.com / Firestore config/allowedEmails check is gone).
 * Authorization decisions — like the user's role — are resolved later by reading
 * the Firestore profile for the VERIFIED uid, never from anything the browser sends.
 *
 * Like every other server unit this is a factory over its one dependency (the token
 * verifier), so it can be built and tested without initializing firebase-admin.
 */
export type IdTokenVerifier = (idToken: string) => Promise<{ uid: string; email?: string }>;

export const createFirebaseAuthMiddleware = (verifyIdToken: IdTokenVerifier): RequestHandler => async (
  req,
  res,
  next
) => {
  const authHeader = req.get('authorization');

  if (!authHeader) {
    return res.status(401).send();
  }

  try {
    const token = await verifyIdToken(authHeader);
    const firebaseUser: VerifiedFirebaseUser = { uid: token.uid, email: token.email };
    res.locals.firebaseUser = firebaseUser;
    next();
  } catch {
    res.status(401).send();
  }
};
