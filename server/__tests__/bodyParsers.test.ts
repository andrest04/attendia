import { parseCreateClassBody } from '../classes';
import { parsePatchProfileBody, parsePostProfileBody } from '../userProfiles';

const validClass = {
  title: '  Matemáticas  ',
  scheduledAtMs: 1_900_000_000_000,
  idempotencyKey: 'class-abcdefgh12345678',
};

describe('parseCreateClassBody', () => {
  it('accepts a minimal body and applies the defaults', () => {
    expect(parseCreateClassBody(validClass)).toEqual({
      ok: true,
      value: {
        title: 'Matemáticas',
        scheduledAtMs: 1_900_000_000_000,
        studentCount: 0,
        durationMinutes: 60,
        idempotencyKey: 'class-abcdefgh12345678',
        explicitRoomName: undefined,
      },
    });
  });

  it('keeps an explicit roomName verbatim (trimmed) so an already-shared link stays valid', () => {
    const result = parseCreateClassBody({ ...validClass, roomName: '  mi-sala  ', studentCount: 12, durationMinutes: 90 });
    expect(result).toMatchObject({ ok: true, value: { explicitRoomName: 'mi-sala', studentCount: 12, durationMinutes: 90 } });
  });

  it.each([
    ['a missing body', undefined, 'invalid title'],
    ['an empty title', { ...validClass, title: '   ' }, 'invalid title'],
    ['a non-numeric schedule', { ...validClass, scheduledAtMs: '1' }, 'invalid scheduledAtMs'],
    ['an infinite schedule', { ...validClass, scheduledAtMs: Infinity }, 'invalid scheduledAtMs'],
    ['a fractional student count', { ...validClass, studentCount: 1.5 }, 'invalid studentCount'],
    ['too many students', { ...validClass, studentCount: 501 }, 'invalid studentCount'],
    ['a zero duration', { ...validClass, durationMinutes: 0 }, 'invalid durationMinutes'],
    ['an 8h+ duration', { ...validClass, durationMinutes: 481 }, 'invalid durationMinutes'],
    ['a short idempotency key', { ...validClass, idempotencyKey: 'short' }, 'invalid idempotencyKey'],
    ['a non-string room name', { ...validClass, roomName: 7 }, 'invalid roomName'],
    ['a blank room name', { ...validClass, roomName: '  ' }, 'invalid roomName'],
  ])('rejects %s', (_label, body, message) => {
    expect(parseCreateClassBody(body)).toMatchObject({ ok: false, message });
  });
});

describe('parsePostProfileBody', () => {
  it('accepts a teacher or a student with a trimmed name', () => {
    expect(parsePostProfileBody({ displayName: ' Ana ', role: 'teacher' })).toEqual({
      ok: true,
      value: { displayName: 'Ana', role: 'teacher' },
    });
    expect(parsePostProfileBody({ displayName: 'Luis', role: 'student' })).toMatchObject({ ok: true });
  });

  it('checks the role before the name', () => {
    expect(parsePostProfileBody({ displayName: '', role: 'admin' })).toMatchObject({ ok: false, message: 'invalid role' });
    expect(parsePostProfileBody({ displayName: '  ', role: 'teacher' })).toMatchObject({
      ok: false,
      message: 'invalid displayName',
    });
    expect(parsePostProfileBody(undefined)).toMatchObject({ ok: false, message: 'invalid role' });
  });
});

describe('parsePatchProfileBody', () => {
  it('builds the update from the allowed fields only', () => {
    expect(parsePatchProfileBody({ displayName: ' Ana ' }, 'a@b.c')).toEqual({ ok: true, value: { displayName: 'Ana' } });
    expect(parsePatchProfileBody({ restorePhoto: true }, undefined)).toEqual({ ok: true, value: { avatarRemoved: false } });
  });

  it('copies the email from the VERIFIED token on syncEmail, never from the body', () => {
    expect(parsePatchProfileBody({ syncEmail: true, email: 'evil@x.y' }, 'real@x.y')).toMatchObject({
      ok: false,
      message: 'invalid profile fields',
    });
    expect(parsePatchProfileBody({ syncEmail: true }, 'real@x.y')).toEqual({ ok: true, value: { email: 'real@x.y' } });
    expect(parsePatchProfileBody({ syncEmail: true }, undefined)).toEqual({ ok: true, value: { email: '' } });
  });

  it.each([
    ['an empty body', {}, 'invalid profile fields'],
    ['an unknown field', { role: 'teacher' }, 'invalid profile fields'],
    ['a blank name', { displayName: ' ' }, 'invalid displayName'],
    ['a 101-char name', { displayName: 'x'.repeat(101) }, 'invalid displayName'],
    ['syncEmail=false', { syncEmail: false }, 'invalid email sync'],
    ['restorePhoto=false', { restorePhoto: false }, 'invalid restorePhoto'],
  ])('rejects %s', (_label, body, message) => {
    expect(parsePatchProfileBody(body, 'a@b.c')).toMatchObject({ ok: false, message });
  });
});
