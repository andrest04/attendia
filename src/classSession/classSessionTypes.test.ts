import {
  createClassSessionAccess,
  toClassSessionDisplayName,
  createDefaultClassSessionDraft,
  isClassSessionDraftReady,
  isTeacherIdentity,
  normalizeStudentJoinInputToRoomName,
  stripTeacherSuffix,
  toClassSessionRoomName,
} from './classSessionTypes';

describe('classSessionTypes helpers', () => {
  it('defaults draft with teacher role, medium sensitivity and recording disabled', () => {
    const draft = createDefaultClassSessionDraft('Teacher Name');

    expect(draft.role).toBe('teacher');
    expect(draft.displayName).toBe('Teacher Name');
    expect(draft.sessionName).toBe('');
    expect(draft.monitoringSensitivity).toBe('medium');
    expect(isClassSessionDraftReady(draft)).toBe(false);
  });

  it('normalizes roomName from sessionName and uses it as joinCode in v1', () => {
    const roomName = toClassSessionRoomName('  Física 101 - Mañana  ');

    expect(roomName).toBe('fisica-101-manana');

    const access = createClassSessionAccess(
      {
        role: 'teacher',
        displayName: 'Teacher Name',
        sessionName: 'Física 101 - Mañana',
        monitoringSensitivity: 'high',
      },
      'https://example.org',
      '?lang=es'
    );

    expect(access.roomName).toBe('fisica-101-manana');
    expect(access.joinCode).toBe(access.roomName);
    expect(access.joinLink).toBe('https://example.org/room/fisica-101-manana?lang=es');
  });

  it('encodes join link when roomName contains reserved characters', () => {
    const access = createClassSessionAccess(
      {
        role: 'teacher',
        displayName: 'Teacher Name',
        sessionName: 'Session: A/B?',
        monitoringSensitivity: 'low',
      },
      'https://example.org',
      ''
    );

    expect(access.joinLink).toContain('/room/session-a-b');
  });

  it('adds teacher suffix for visible identity before token handoff', () => {
    expect(toClassSessionDisplayName('Andres Torres', 'teacher')).toBe('Andres Torres [Profesor]');
    expect(toClassSessionDisplayName('Andres Torres [Profesor]', 'teacher')).toBe('Andres Torres [Profesor]');
    expect(toClassSessionDisplayName('Ana Lopez', 'student')).toBe('Ana Lopez');
  });

  it('detects the teacher role from the participant identity suffix', () => {
    expect(isTeacherIdentity('Andres Torres [Profesor]')).toBe(true);
    expect(isTeacherIdentity('Andres Torres [profesor]')).toBe(true);
    expect(isTeacherIdentity('  Andres Torres [Profesor]  ')).toBe(true);
    expect(isTeacherIdentity(toClassSessionDisplayName('Ana Lopez', 'teacher'))).toBe(true);
    expect(isTeacherIdentity('Ana Lopez')).toBe(false);
    expect(isTeacherIdentity('')).toBe(false);
    expect(isTeacherIdentity(undefined)).toBe(false);
    expect(isTeacherIdentity(null)).toBe(false);
  });

  it('normalizes student join input from room code and full links', () => {
    expect(normalizeStudentJoinInputToRoomName('fisica-101')).toBe('fisica-101');
    expect(normalizeStudentJoinInputToRoomName('https://example.org/room/fisica-101')).toBe('fisica-101');
    expect(normalizeStudentJoinInputToRoomName('https://example.org/room/fisica-101?lang=es&utm=campaign')).toBe(
      'fisica-101'
    );
    // Spaces/casing in the extracted segment are slugified to match the teacher's room.
    expect(normalizeStudentJoinInputToRoomName('https://example.org/room/fisica-101%20avanzada?lang=es')).toBe(
      'fisica-101-avanzada'
    );
  });

  it('slugifies a manually typed room name the same way the teacher session name is slugified', () => {
    expect(normalizeStudentJoinInputToRoomName('Test')).toBe('test');
    expect(normalizeStudentJoinInputToRoomName('TEST')).toBe('test');
    expect(normalizeStudentJoinInputToRoomName('  Física 101  ')).toBe('fisica-101');
    // A friendly name and the slug a teacher shares both resolve to the same room.
    expect(normalizeStudentJoinInputToRoomName('Física 101')).toBe(toClassSessionRoomName('Física 101'));
  });

  it('returns an empty room name for blank student input', () => {
    expect(normalizeStudentJoinInputToRoomName('')).toBe('');
    expect(normalizeStudentJoinInputToRoomName('   ')).toBe('');
  });

  it('strips the teacher suffix to recover the base display name', () => {
    expect(stripTeacherSuffix('Andres Torres [Profesor]')).toBe('Andres Torres');
    // Case-insensitive on the suffix.
    expect(stripTeacherSuffix('Andres Torres [profesor]')).toBe('Andres Torres');
    // Trims surrounding/leftover whitespace.
    expect(stripTeacherSuffix('  Andres Torres   [Profesor]  ')).toBe('Andres Torres');
    // Student names (no suffix) are returned untouched (trimmed).
    expect(stripTeacherSuffix('Ana Lopez')).toBe('Ana Lopez');
    expect(stripTeacherSuffix('  Ana Lopez  ')).toBe('Ana Lopez');
    // Idempotent and null-safe.
    expect(stripTeacherSuffix(stripTeacherSuffix('Andres Torres [Profesor]'))).toBe('Andres Torres');
    expect(stripTeacherSuffix('')).toBe('');
    expect(stripTeacherSuffix(undefined)).toBe('');
    expect(stripTeacherSuffix(null)).toBe('');
  });

  it('round-trips with toClassSessionDisplayName for teachers', () => {
    const base = 'Andres Torres';
    const visible = toClassSessionDisplayName(base, 'teacher');
    expect(stripTeacherSuffix(visible)).toBe(base);
  });
});
