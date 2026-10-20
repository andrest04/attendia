import { resolveClassAction } from './classAction';

describe('resolveClassAction', () => {
  it('offers to start a scheduled class, and treats a missing status as scheduled', () => {
    expect(resolveClassAction('scheduled', undefined)).toBe('start');
    expect(resolveClassAction(undefined, undefined)).toBe('start');
    expect(resolveClassAction('scheduled', true)).toBe('start');
  });

  it('offers nothing for a completed class', () => {
    expect(resolveClassAction('completed', true)).toBe('none');
  });

  it('offers re-entry to a started class whose room is still open', () => {
    expect(resolveClassAction('started', true)).toBe('rejoin');
  });

  it('waits for the probe of a started class that has not been checked yet', () => {
    expect(resolveClassAction('started', undefined)).toBe('checking');
  });

  it('offers an explicit restart when the started class room is closed', () => {
    expect(resolveClassAction('started', false)).toBe('closed-restart');
  });

  it('falls back to the plain start flow when the probe was inconclusive', () => {
    expect(resolveClassAction('started', null)).toBe('start');
  });
});
