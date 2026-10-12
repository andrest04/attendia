import { teacherHandler } from '../teacherHandler';
import { HttpError } from '../http';

const makeRes = (firebaseUser: any = { uid: 'u1' }) => {
  const res: any = { locals: { firebaseUser } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

const makeDb = (profile: any) => {
  const get = jest.fn().mockImplementation(() => (profile instanceof Error ? Promise.reject(profile) : Promise.resolve(profile)));
  return { db: { collection: () => ({ doc: () => ({ get }) }) } as any, get };
};

const options = {
  forbiddenExplanation: 'solo profes',
  failure: { event: 'thing_failed', operation: 'GET /thing', message: 'thing failed', explanation: 'falló' },
};

describe('teacherHandler', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  it('answers 401 without a verified user and never touches Firestore', async () => {
    const { db, get } = makeDb({ exists: true, data: () => ({ role: 'teacher' }) });
    const work = jest.fn();
    const res = makeRes(null);

    await teacherHandler(db, options, work)({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(get).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
  });

  it('answers 403 with the endpoint copy when the profile is not a teacher', async () => {
    const { db } = makeDb({ exists: true, data: () => ({ role: 'student' }) });
    const work = jest.fn();
    const res = makeRes();

    await teacherHandler(db, options, work)({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'teacher role required', explanation: 'solo profes' } });
    expect(work).not.toHaveBeenCalled();
  });

  it('answers 403 when the profile does not exist', async () => {
    const { db } = makeDb({ exists: false, data: () => undefined });
    const res = makeRes();

    await teacherHandler(db, options, jest.fn())({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('runs the work with the verified uid for a teacher', async () => {
    const { db } = makeDb({ exists: true, data: () => ({ role: 'teacher' }) });
    const work = jest.fn().mockResolvedValue(undefined);
    const req: any = { params: { id: 'x' } };
    const res = makeRes({ uid: 'teacher-1' });

    await teacherHandler(db, options, work)(req, res, jest.fn());

    expect(work).toHaveBeenCalledWith({ uid: 'teacher-1', req, res });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('runs preValidate BEFORE the role lookup, so a bad request is a 400 even for a non-teacher', async () => {
    const { db, get } = makeDb({ exists: true, data: () => ({ role: 'student' }) });
    const res = makeRes();
    const preValidate = jest.fn((_req, response) => {
      response.status(400).json({});
      return false;
    });

    await teacherHandler(db, { ...options, preValidate }, jest.fn())({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(get).not.toHaveBeenCalled();
  });

  it('logs and answers the endpoint 503 when the role lookup itself fails', async () => {
    const { db } = makeDb(new Error('firestore down'));
    const res = makeRes();

    await teacherHandler(db, options, jest.fn())({ params: { roomSid: 'RM1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'thing failed', explanation: 'falló' } });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"failure":"thing_failed"'));
  });

  it('attaches logContext identifiers to the failure log', async () => {
    const { db } = makeDb({ exists: true, data: () => ({ role: 'teacher' }) });
    const work = jest.fn().mockRejectedValue(new Error('boom'));

    await teacherHandler(db, { ...options, logContext: req => ({ classId: req.params.id }) }, work)(
      { params: { id: 'class-9' } } as any,
      makeRes(),
      jest.fn()
    );

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"classId":"class-9"'));
  });

  it('lets mapError turn a typed error into its own response instead of the generic 503', async () => {
    const { db } = makeDb({ exists: true, data: () => ({ role: 'teacher' }) });
    const res = makeRes();
    const mapError = jest.fn((error: unknown, response: any) => {
      if (!HttpError.is(error, 409)) return false;
      response.status(409).json({});
      return true;
    });

    await teacherHandler(db, { ...options, mapError }, jest.fn().mockRejectedValue(HttpError.conflict('dup')))(
      {} as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
