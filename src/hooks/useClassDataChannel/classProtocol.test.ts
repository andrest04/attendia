import { canModerate } from './classProtocol';

const student = { isTeacher: false, isLocal: false };
const teacher = { isTeacher: true, isLocal: false };

describe('canModerate', () => {
  it('lets the owner and a co-teacher moderate a student', () => {
    expect(canModerate('owner', student)).toBe(true);
    expect(canModerate('co-teacher', student)).toBe(true);
  });

  it('lets an owner whose role is still loading moderate students (fail closed only for teachers)', () => {
    expect(canModerate('unknown', student)).toBe(true);
    expect(canModerate(undefined, student)).toBe(true);
  });

  it('lets only the owner moderate another teacher', () => {
    expect(canModerate('owner', teacher)).toBe(true);
    expect(canModerate('co-teacher', teacher)).toBe(false);
  });

  it('fails closed on teachers while the role is unknown or missing', () => {
    expect(canModerate('unknown', teacher)).toBe(false);
    expect(canModerate(undefined, teacher)).toBe(false);
    expect(canModerate(null, teacher)).toBe(false);
  });

  it('never lets a student moderate anyone', () => {
    expect(canModerate('student', student)).toBe(false);
    expect(canModerate('student', teacher)).toBe(false);
  });

  it('never lets anyone moderate themselves', () => {
    expect(canModerate('owner', { isTeacher: true, isLocal: true })).toBe(false);
    expect(canModerate('co-teacher', { isTeacher: true, isLocal: true })).toBe(false);
    expect(canModerate('owner', { isTeacher: false, isLocal: true })).toBe(false);
  });
});
