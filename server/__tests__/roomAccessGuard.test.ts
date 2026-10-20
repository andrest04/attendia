import {
  createProfileRoleResolver,
  createRoomAccessGuard,
  identitySuffixRole,
  isTeacherIdentity,
  RoomExistenceChecker,
} from '../roomAccessGuard';

const makeRes = (uid: string | null = 'uid-1') => {
  const res: any = { locals: uid ? { firebaseUser: { uid } } : {} };
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

  describe('create_room:false (join-only) requests', () => {
    it('lets a join-only request through when the room exists', async () => {
      roomExists.mockResolvedValue(true);
      const guard = createRoomAccessGuard(roomExists);
      const res = makeRes();

      await guard({ body: { user_identity: 'María', room_name: 'p', create_room: false } } as any, res, next);

      expect(roomExists).toHaveBeenCalledWith('p');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects a join-only request with 403 when the room does not exist', async () => {
      roomExists.mockResolvedValue(false);
      const guard = createRoomAccessGuard(roomExists);
      const res = makeRes();

      await guard({ body: { user_identity: 'María', room_name: 'p', create_room: false } } as any, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ message: 'room not found' }) })
      );
    });

    it('rejects a join-only request without room_name with 400', async () => {
      const guard = createRoomAccessGuard(roomExists);
      const res = makeRes();

      await guard({ body: { user_identity: 'María', create_room: false } } as any, res, next);

      expect(roomExists).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('fails closed with 503 when the join-only existence check fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      roomExists.mockRejectedValue(new Error('twilio down'));
      const guard = createRoomAccessGuard(roomExists);
      const res = makeRes();

      await guard({ body: { user_identity: 'María', room_name: 'p', create_room: false } } as any, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
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

  describe('profile-verified teachers (createProfileRoleResolver)', () => {
    const makeProfileDb = (profile: any) => {
      const get = jest.fn().mockImplementation(() =>
        profile instanceof Error ? Promise.reject(profile) : Promise.resolve(profile)
      );
      const doc = jest.fn(() => ({ get }));
      const collection = jest.fn(() => ({ doc }));
      return { db: { collection } as any, collection, doc, get };
    };
    const teacherProfile = { exists: true, data: () => ({ role: 'teacher' }) };
    const studentProfile = { exists: true, data: () => ({ role: 'student' }) };

    it('treats a suffixed identity as teacher only when users/{uid}.role is teacher', async () => {
      const { db, collection, doc } = makeProfileDb(teacherProfile);
      const resolve = createProfileRoleResolver(db);

      expect(await resolve({ body: { user_identity: 'Ana [Profesor]' } } as any, makeRes('uid-1'))).toBe('teacher');
      expect(collection).toHaveBeenCalledWith('users');
      expect(doc).toHaveBeenCalledWith('uid-1');
    });

    it('resolves a non-suffixed identity as student without a profile lookup', async () => {
      const { db, get } = makeProfileDb(teacherProfile);
      const resolve = createProfileRoleResolver(db);

      expect(await resolve({ body: { user_identity: 'Ana' } } as any, makeRes())).toBe('student');
      expect(get).not.toHaveBeenCalled();
    });

    it('rejects a teacher suffix from a non-teacher profile with 403 before any room check', async () => {
      const { db } = makeProfileDb(studentProfile);
      const guard = createRoomAccessGuard(roomExists, createProfileRoleResolver(db));
      const res = makeRes();

      await guard({ body: { user_identity: 'Mallory [Profesor]', room_name: 'p' } } as any, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(roomExists).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'teacher role required', explanation: expect.any(String) },
      });
    });

    it('rejects a teacher suffix when the profile does not exist', async () => {
      const { db } = makeProfileDb({ exists: false, data: () => undefined });
      const guard = createRoomAccessGuard(roomExists, createProfileRoleResolver(db));
      const res = makeRes();

      await guard({ body: { user_identity: 'Ana [Profesor]', room_name: 'p' } } as any, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a teacher suffix even on a join-only request into an open room', async () => {
      roomExists.mockResolvedValue(true);
      const { db } = makeProfileDb(studentProfile);
      const guard = createRoomAccessGuard(roomExists, createProfileRoleResolver(db));
      const res = makeRes();

      await guard({ body: { user_identity: 'Mallory [Profesor]', room_name: 'p', create_room: false } } as any, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('fails closed with 503 when the profile lookup fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { db } = makeProfileDb(new Error('firestore down'));
      const guard = createRoomAccessGuard(roomExists, createProfileRoleResolver(db));
      const res = makeRes();

      await guard({ body: { user_identity: 'Ana [Profesor]', room_name: 'p' } } as any, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('room ownership claim for teachers', () => {
    it('claims the room for the verified uid and lets the teacher through', async () => {
      const claimRoom = jest.fn().mockResolvedValue(true);
      const guard = createRoomAccessGuard(roomExists, () => 'teacher', claimRoom);
      const res = makeRes('teacher-1');

      await guard({ body: { user_identity: 'Ana [Profesor]', room_name: 'p' } } as any, res, next);

      expect(claimRoom).toHaveBeenCalledWith('p', 'teacher-1');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('answers 403 while another teacher\'s fresh claim on that name is not open yet', async () => {
      const claimRoom = jest.fn().mockResolvedValue(false);
      const guard = createRoomAccessGuard(roomExists, () => 'teacher', claimRoom);
      const res = makeRes('teacher-1');

      await guard({ body: { user_identity: 'Ana [Profesor]', room_name: 'p' } } as any, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'room owned by another teacher', explanation: expect.any(String) },
      });
    });

    it('also claims on a join-only teacher request once the room is confirmed open', async () => {
      roomExists.mockResolvedValue(true);
      const claimRoom = jest.fn().mockResolvedValue(true);
      const guard = createRoomAccessGuard(roomExists, () => 'teacher', claimRoom);

      await guard({ body: { user_identity: 'Ana [Profesor]', room_name: 'p', create_room: false } } as any, makeRes(), next);

      expect(claimRoom).toHaveBeenCalledWith('p', 'uid-1');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('never claims for a student', async () => {
      roomExists.mockResolvedValue(true);
      const claimRoom = jest.fn();
      const guard = createRoomAccessGuard(roomExists, () => 'student', claimRoom);

      await guard({ body: { user_identity: 'María', room_name: 'p' } } as any, makeRes(), next);

      expect(claimRoom).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('answers 403 when a teacher has no verified uid to claim with', async () => {
      const claimRoom = jest.fn();
      const guard = createRoomAccessGuard(roomExists, () => 'teacher', claimRoom);
      const res = makeRes(null);

      await guard({ body: { user_identity: 'Ana [Profesor]', room_name: 'p' } } as any, res, next);

      expect(claimRoom).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('fails closed with 503 when the claim throws', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const claimRoom = jest.fn().mockRejectedValue(new Error('firestore down'));
      const guard = createRoomAccessGuard(roomExists, () => 'teacher', claimRoom);
      const res = makeRes();

      await guard({ body: { user_identity: 'Ana [Profesor]', room_name: 'p' } } as any, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
