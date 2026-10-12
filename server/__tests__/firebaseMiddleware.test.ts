import { createFirebaseAuthMiddleware } from '../firebaseAuthMiddleware';

const makeResponse = () => {
  const res: any = { locals: {} };
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

const mockRequest: any = { get: jest.fn(() => 'mockToken') };
const mockNext = jest.fn();
const mockVerifyIdToken = jest.fn();
const firebaseAuthMiddleware = createFirebaseAuthMiddleware(mockVerifyIdToken);

describe('the firebaseAuthMiddleware function', () => {
  afterEach(jest.clearAllMocks);

  it('should return a 401 when there is no authorization header', async () => {
    const mockRequestWithoutHeader: any = { get: () => '' };
    const res = makeResponse();
    await firebaseAuthMiddleware(mockRequestWithoutHeader, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
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
