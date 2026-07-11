/* eslint-disable import/first */
process.env.REACT_APP_FIREBASE_DATABASE_URL = 'mockURL';

import firebaseAuthMiddleware from '../firebaseAuthMiddleware';
import firebaseAdmin from 'firebase-admin';

jest.mock('../serviceAccountKey.json', () => ({ mockCertificate: 'foo' }), { virtual: true });
jest.mock('firebase-admin', () => {
  const mockVerifyIdToken = jest.fn();
  const mockFirestore: any = jest.fn(() => ({}));
  mockFirestore.FieldValue = { serverTimestamp: jest.fn(() => 'server-timestamp') };

  return {
    initializeApp: jest.fn(),
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
    }),
    firestore: mockFirestore,
    storage: () => ({
      bucket: jest.fn(() => ({})),
    }),
    credential: {
      cert: jest.fn((cert: any) => cert),
    },
  };
});

const mockRequest: any = { get: jest.fn(() => 'mockToken') };

const makeResponse = () => {
  const res: any = { locals: {} };
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

const mockNext = jest.fn();

const mockVerifyIdToken = firebaseAdmin.auth().verifyIdToken as jest.Mock<any>;

describe('the firebaseAuthMiddleware function', () => {
  afterEach(jest.clearAllMocks);

  it('should correctly initialize the firebase client exactly once (shared firebaseAdmin module)', async () => {
    mockVerifyIdToken.mockImplementationOnce(() => Promise.resolve({ uid: 'uid-1', email: 'test@foo.com' }));
    await firebaseAuthMiddleware(mockRequest, makeResponse(), mockNext);
    expect(firebaseAdmin.initializeApp).toHaveBeenCalledTimes(1);
    expect(firebaseAdmin.initializeApp).toHaveBeenCalledWith({
      credential: { mockCertificate: 'foo' },
      databaseURL: 'mockURL',
    });
  });

  it('should return a 401 when there is no authorization header', async () => {
    const mockRequestWithoutHeader: any = { get: () => '' };
    const res = makeResponse();
    await firebaseAuthMiddleware(mockRequestWithoutHeader, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return a 401 when there is an error verifying the token', async () => {
    mockVerifyIdToken.mockImplementationOnce(() => Promise.reject());
    const res = makeResponse();
    await firebaseAuthMiddleware(mockRequest, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next for any valid token — registration is open, there is no email allowlist', async () => {
    mockVerifyIdToken.mockImplementationOnce(() =>
      Promise.resolve({ uid: 'uid-1', email: 'anyone@example.com' })
    );
    const res = makeResponse();
    await firebaseAuthMiddleware(mockRequest, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('should attach the decoded uid and email to res.locals.firebaseUser', async () => {
    mockVerifyIdToken.mockImplementationOnce(() =>
      Promise.resolve({ uid: 'uid-42', email: 'ana@example.com', otherClaim: 'ignored' })
    );
    const res = makeResponse();
    await firebaseAuthMiddleware(mockRequest, res, mockNext);
    expect(res.locals.firebaseUser).toEqual({ uid: 'uid-42', email: 'ana@example.com' });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should pass through a valid token without an email claim (email stays undefined)', async () => {
    mockVerifyIdToken.mockImplementationOnce(() => Promise.resolve({ uid: 'uid-noemail' }));
    const res = makeResponse();
    await firebaseAuthMiddleware(mockRequest, res, mockNext);
    expect(res.locals.firebaseUser).toEqual({ uid: 'uid-noemail', email: undefined });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should call verifyIdToken with the authorization header from the request', async () => {
    mockVerifyIdToken.mockImplementationOnce(() => Promise.resolve({ uid: 'uid-1', email: 'test@example.com' }));
    await firebaseAuthMiddleware(mockRequest, makeResponse(), mockNext);
    expect(mockRequest.get).toHaveBeenLastCalledWith('authorization');
    expect(mockVerifyIdToken).toHaveBeenCalledWith('mockToken');
  });
});
