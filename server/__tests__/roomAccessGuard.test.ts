import { createRoomAccessGuard, identitySuffixRole, isTeacherIdentity, RoomExistenceChecker } from '../roomAccessGuard';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('isTeacherIdentity', () => {
  it('returns true for an identity ending with the teacher suffix', () => {
    expect(isTeacherIdentity('Ana [Profesor]')).toBe(true);
  });

  it('is case-insensitive and tolerant of surrounding whitespace', () => {
    expect(isTeacherIdentity('  ana [profesor]  ')).toBe(true);
  });

  it('returns false for a student identity', () => {
    expect(isTeacherIdentity('María González')).toBe(false);
  });

  it('returns false when the suffix is not at the end', () => {
    expect(isTeacherIdentity('[Profesor] Ana')).toBe(false);
  });

  it('returns false for non-string or empty values', () => {
    expect(isTeacherIdentity(undefined)).toBe(false);
    expect(isTeacherIdentity(null)).toBe(false);
    expect(isTeacherIdentity(42)).toBe(false);
    expect(isTeacherIdentity('')).toBe(false);
  });
});

describe('createRoomAccessGuard', () => {
  let roomExists: jest.MockedFunction<RoomExistenceChecker>;
  let next: jest.Mock;

  beforeEach(() => {
    roomExists = jest.fn();
    next = jest.fn();
  });

  it('lets a teacher through so the token function can create the room', async () => {
    const guard = createRoomAccessGuard(roomExists);
    const res = makeRes();

    await guard({ body: { user_identity: 'Ana [Profesor]', room_name: 'p' } } as any, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(roomExists).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('lets a student through when the room already exists', async () => {
    roomExists.mockResolvedValue(true);
    const guard = createRoomAccessGuard(roomExists);
    const res = makeRes();

    await guard({ body: { user_identity: 'María', room_name: 'p' } } as any, res, next);

    expect(roomExists).toHaveBeenCalledWith('p');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a student with 403 when the room does not exist', async () => {
    roomExists.mockResolvedValue(false);
    const guard = createRoomAccessGuard(roomExists);
    const res = makeRes();

    await guard({ body: { user_identity: 'María', room_name: 'p' } } as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'room not found' }) })
    );
  });

  it('responds 503 when the existence check itself fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    roomExists.mockRejectedValue(new Error('twilio down'));
    const guard = createRoomAccessGuard(roomExists);
    const res = makeRes();

    await guard({ body: { user_identity: 'María', room_name: 'p' } } as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });

  it('does not gate create_room:false requests (e.g. the passcode probe)', async () => {
    const guard = createRoomAccessGuard(roomExists);
    const res = makeRes();

    await guard(
      { body: { user_identity: 'temp-name', room_name: 'temp-room', create_room: false } } as any,
      res,
      next
    );

    expect(roomExists).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('defers to the token function when a student request has no room_name', async () => {
    const guard = createRoomAccessGuard(roomExists);
    const res = makeRes();

    await guard({ body: { user_identity: 'María' } } as any, res, next);

    expect(roomExists).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('treats a missing create_room as a room-creating request (gates students)', async () => {
    roomExists.mockResolvedValue(false);
    const guard = createRoomAccessGuard(roomExists);
    const res = makeRes();

    await guard({ body: { user_identity: 'María', room_name: 'p' } } as any, res, next);

    expect(roomExists).toHaveBeenCalledWith('p');
    expect(res.status).toHaveBeenCalledWith(403);
  });

  describe('role resolution strategy', () => {
    it('identitySuffixRole reads the role from the client-set identity suffix', () => {
      expect(identitySuffixRole({ body: { user_identity: 'Ana [Profesor]' } } as any, makeRes())).toBe('teacher');
      expect(identitySuffixRole({ body: { user_identity: 'María' } } as any, makeRes())).toBe('student');
      expect(identitySuffixRole({} as any, makeRes())).toBe('student');
    });

    it('lets a pluggable resolver override the identity suffix (e.g. a verified role)', async () => {
      roomExists.mockResolvedValue(false);
      const guard = createRoomAccessGuard(roomExists, async () => 'student');
      const res = makeRes();

      // A forged teacher suffix no longer opens the room once the role comes from elsewhere.
      await guard({ body: { user_identity: 'Mallory [Profesor]', room_name: 'p' } } as any, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('lets a resolved teacher through without checking the room', async () => {
      const guard = createRoomAccessGuard(roomExists, () => 'teacher');

      await guard({ body: { user_identity: 'María', room_name: 'p' } } as any, makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(roomExists).not.toHaveBeenCalled();
    });

    it('fails closed with 503 when the resolver throws', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const guard = createRoomAccessGuard(roomExists, () => {
        throw new Error('role lookup down');
      });
      const res = makeRes();

      await guard({ body: { user_identity: 'María', room_name: 'p' } } as any, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
