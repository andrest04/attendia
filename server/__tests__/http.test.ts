import {
  createFileSizeLimitErrorHandler,
  getVerifiedUser,
  HttpError,
  parseFail,
  parseOk,
  sendBadRequest,
  sendError,
  sendParseError,
  sendTeacherOnly,
} from '../http';

const makeRes = (locals: any = {}) => {
  const res: any = { locals };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('getVerifiedUser', () => {
  it('returns the identity attached by the auth middleware', () => {
    const res = makeRes({ firebaseUser: { uid: 'u1', email: 'a@b.c' } });
    expect(getVerifiedUser(res)).toEqual({ uid: 'u1', email: 'a@b.c' });
  });

  it.each([[undefined], [{}], [{ uid: '' }], [{ uid: 42 }]])('rejects %p', firebaseUser => {
    expect(getVerifiedUser(makeRes({ firebaseUser }))).toBeUndefined();
  });

  it('tolerates a response without locals', () => {
    expect(getVerifiedUser({} as any)).toBeUndefined();
  });
});

describe('error senders', () => {
  it('sendError writes the { error: { message, explanation } } envelope', () => {
    const res = makeRes();
    sendError(res, 418, 'm', 'e');
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'm', explanation: 'e' } });
  });

  it('sendBadRequest is a 400 and sendTeacherOnly a 403 with a fixed message', () => {
    const bad = makeRes();
    sendBadRequest(bad, 'm', 'e');
    expect(bad.status).toHaveBeenCalledWith(400);

    const forbidden = makeRes();
    sendTeacherOnly(forbidden, 'solo profes');
    expect(forbidden.status).toHaveBeenCalledWith(403);
    expect(forbidden.json).toHaveBeenCalledWith({ error: { message: 'teacher role required', explanation: 'solo profes' } });
  });

  it('sendParseError answers a parse failure with a 400', () => {
    const res = makeRes();
    sendParseError(res, parseFail('m', 'e') as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('ParseResult helpers', () => {
  it('wraps values and failures in a discriminated union', () => {
    expect(parseOk(5)).toEqual({ ok: true, value: 5 });
    expect(parseFail('m', 'e')).toEqual({ ok: false, message: 'm', explanation: 'e' });
  });
});

describe('HttpError', () => {
  it('builds typed errors with the matching status and stays an Error', () => {
    expect(HttpError.badRequest('x').status).toBe(400);
    expect(HttpError.notFound('x').status).toBe(404);
    expect(HttpError.conflict('x').status).toBe(409);
    expect(HttpError.conflict('x')).toBeInstanceOf(Error);
    expect(HttpError.conflict('x')).toBeInstanceOf(HttpError);
    expect(HttpError.notFound('boom').message).toBe('boom');
  });

  it('is() matches by status for typed errors and for plain objects carrying a status', () => {
    expect(HttpError.is(HttpError.notFound('x'), 404)).toBe(true);
    expect(HttpError.is(HttpError.notFound('x'), 409)).toBe(false);
    expect(HttpError.is({ status: 404 }, 404)).toBe(true);
    expect(HttpError.is(null, 404)).toBe(false);
    expect(HttpError.is('404', 404)).toBe(false);
  });
});

describe('createFileSizeLimitErrorHandler', () => {
  const handler = createFileSizeLimitErrorHandler({ message: 'too big', explanation: 'máx 2 MB' });

  it('answers multer LIMIT_FILE_SIZE with the route copy', () => {
    const res = makeRes();
    const next = jest.fn();
    handler({ code: 'LIMIT_FILE_SIZE' }, {} as any, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'too big', explanation: 'máx 2 MB' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards every other error', () => {
    const next = jest.fn();
    const error = new Error('other');
    handler(error, {} as any, makeRes(), next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
