import firebaseAdmin from 'firebase-admin';

/*
 * Single shared firebase-admin initialization.
 *
 * Both the auth middleware and the profile endpoints import their handles from
 * this module, so initializeApp runs exactly once no matter how many modules
 * need firebase-admin. The service account credential lives in
 * server/serviceAccountKey.json (gitignored — never log or expose its contents).
 *
 * Firebase is the only auth mode this app supports, so server/index.ts always
 * requires this module — the key file must exist for every deployment.
 */
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(require('./serviceAccountKey.json')),
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
});

export const firebaseApp = firebaseAdmin;
export const auth = firebaseAdmin.auth();
export const firestore = firebaseAdmin.firestore();

// Injected into the profile handlers so they stay decoupled from firebase-admin
// (and trivially mockable in tests, mirroring the createCompleteRoomHandler style).
export const serverTimestamp = () => firebaseAdmin.firestore.FieldValue.serverTimestamp();
