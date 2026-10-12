import { firstResolved } from './firstResolved';

describe('firstResolved', () => {
  it('returns the answer of the first resolver that has one', () => {
    const result = firstResolved(2, [() => undefined, n => n * 10, () => 99]);

    expect(result).toBe(20);
  });

  it('stops asking once a resolver answers', () => {
    const later = jest.fn(() => 'late');

    firstResolved(0, [() => 'first', later]);

    expect(later).not.toHaveBeenCalled();
  });

  it('passes the context to every resolver it consults', () => {
    const first = jest.fn(() => undefined);
    const second = jest.fn(() => 'x');

    firstResolved({ id: 1 }, [first, second]);

    expect(first).toHaveBeenCalledWith({ id: 1 });
    expect(second).toHaveBeenCalledWith({ id: 1 });
  });

  it('is undefined when nobody answers, and for an empty list', () => {
    expect(firstResolved(1, [() => undefined, () => undefined])).toBeUndefined();
    expect(firstResolved(1, [])).toBeUndefined();
  });

  it('treats falsy answers as answers', () => {
    expect(firstResolved(1, [() => '', () => 'later'])).toBe('');
    expect(firstResolved(1, [() => 0, () => 1])).toBe(0);
    expect(firstResolved(1, [() => false, () => true])).toBe(false);
    expect(firstResolved(1, [() => null, () => 'later'])).toBeNull();
  });
});
