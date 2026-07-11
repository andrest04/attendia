const path = require('path');
const firebaseAdmin = require('firebase-admin');

const uid = process.argv[2];
if (!uid) throw new Error('Usage: npm run firebase:bootstrap-teacher -- <firebase-uid>');

const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, '../server/serviceAccountKey.json');
firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(require(credentialPath)) });

firebaseAdmin
  .firestore()
  .collection('users')
  .doc(uid)
  .set(
    {
      role: 'teacher',
      teacherProvisionedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      teacherProvisionedBy: 'manual-bootstrap',
    },
    { merge: true }
  )
  .then(() => console.log(`Teacher role provisioned for ${uid}.`));
