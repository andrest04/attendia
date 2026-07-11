import firebaseAdmin from 'firebase-admin';

/*
 * Single shared firebase-admin initialization.
 *
 * Both the auth middleware and the profile endpoints import their handles from
 * this module, so initializeApp runs exactly once no matter how many modules
 * need firebase-admin. The service account credential lives in
 * server/serviceAccountKey.json (gitignored — never log or expose its contents).
 *
 * This module must only be required when REACT_APP_SET_AUTH === 'firebase'
 * (see the conditional requires in index.ts), so non-firebase deployments never
 * need the key file to exist.
 */
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(require('./serviceAccountKey.json')),
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
});

export const firebaseApp = firebaseAdmin;
export const auth = firebaseAdmin.auth();
export const firestore = firebaseAdmin.firestore();
// Default bucket for the "Recursos" tab (teacher-uploaded class materials/recordings).
export const storageBucket = firebaseAdmin.storage().bucket();

// Injected into the profile handlers so they stay decoupled from firebase-admin
// (and trivially mockable in tests, mirroring the createCompleteRoomHandler style).
export const serverTimestamp = () => firebaseAdmin.firestore.FieldValue.serverTimestamp();
