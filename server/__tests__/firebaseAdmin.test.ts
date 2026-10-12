/* eslint-disable import/first */
process.env.REACT_APP_FIREBASE_DATABASE_URL = 'mockURL';

import firebaseAdmin from 'firebase-admin';

jest.mock('../serviceAccountKey.json', () => ({ mockCertificate: 'foo' }), { virtual: true });
jest.mock('firebase-admin', () => {
  const mockFirestore: any = jest.fn(() => ({}));
  mockFirestore.FieldValue = { serverTimestamp: jest.fn(() => 'server-timestamp') };

  return {
    initializeApp: jest.fn(),
    auth: () => ({ verifyIdToken: jest.fn() }),
    firestore: mockFirestore,
    storage: () => ({ bucket: jest.fn(() => ({})) }),
    credential: { cert: jest.fn((cert: any) => cert) },
  };
});

describe('the shared firebase-admin module', () => {
  it('should correctly initialize the firebase client exactly once, however many modules import it', () => {
    jest.isolateModules(() => {
      require('../firebaseAdmin');
      require('../firebaseAdmin');
    });
    expect(firebaseAdmin.initializeApp).toHaveBeenCalledTimes(1);
    expect(firebaseAdmin.initializeApp).toHaveBeenCalledWith({
      credential: { mockCertificate: 'foo' },
      databaseURL: 'mockURL',
    });
  });
});
