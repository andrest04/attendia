import { ClientApiError, createApiClient, isPermanentClientError, throwOnErrorResponse, withUser } from './apiClient';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
import { FirebaseError } from 'firebase/app';

const mockFetch = jest.fn();
window.fetch = mockFetch;

const makeUser = () => ({ getIdToken: jest.fn(() => Promise.resolve('idToken')) });

const response = (status: number, body: any = {}, extra: any = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: `status ${status}`,
  json: () => Promise.resolve(body),
  blob: () => Promise.resolve(new Blob(['x'])),
  ...extra,
});

describe('createApiClient', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sends a GET with only the Authorization header (no method key)', async () => {
    const user = makeUser();
    mockFetch.mockResolvedValueOnce(response(200, { a: 1 }));

    await expect(createApiClient(user).json('/thing')).resolves.toEqual({ a: 1 });

    expect(mockFetch).toHaveBeenCalledWith('/thing', { headers: { Authorization: 'idToken' } });
    expect(user.getIdToken).toHaveBeenCalledWith();
  });

  it('serializes a JSON body with the matching content-type', async () => {
    mockFetch.mockResolvedValueOnce(response(201, {}));

    await createApiClient(makeUser()).json('/thing', { method: 'POST', json: { b: 2 } });

    expect(mockFetch).toHaveBeenCalledWith('/thing', {
      method: 'POST',
      headers: { Authorization: 'idToken', 'content-type': 'application/json' },
      body: '{"b":2}',
    });
  });

  it('passes a raw body (FormData) through without forcing a content-type', async () => {
    const form = new FormData();
    mockFetch.mockResolvedValueOnce(response(200));

    await createApiClient(makeUser()).json('/upload', { method: 'POST', body: form });

    expect(mockFetch).toHaveBeenCalledWith('/upload', {
      method: 'POST',
      headers: { Authorization: 'idToken' },
      body: form,
    });
  });

  it('merges extra headers such as Idempotency-Key', async () => {
    mockFetch.mockResolvedValueOnce(response(200));

    await createApiClient(makeUser()).json('/notifications', {
      method: 'DELETE',
      headers: { 'Idempotency-Key': 'k1' },
    });

    expect(mockFetch).toHaveBeenCalledWith('/notifications', {
      method: 'DELETE',
      headers: { Authorization: 'idToken', 'Idempotency-Key': 'k1' },
    });
  });

  it('asks Firebase for a fresh token only when forceRefresh is set', async () => {
    const user = makeUser();
    mockFetch.mockResolvedValue(response(200));

    await createApiClient(user).send('/a');
    expect(user.getIdToken).toHaveBeenLastCalledWith();

    await createApiClient(user).send('/b', { forceRefresh: true });
    expect(user.getIdToken).toHaveBeenLastCalledWith(true);
  });

  it('raw() hands back non-OK responses untouched so callers can branch on the status', async () => {
    mockFetch.mockResolvedValueOnce(response(404));

    const result = await createApiClient(makeUser()).raw('/profile');

    expect(result.status).toBe(404);
  });

  it('turns a non-OK response into a ClientApiError carrying the server explanation', async () => {
    mockFetch.mockResolvedValueOnce(
      response(403, { error: { message: 'teacher role required', explanation: 'Solo profesores.' } })
    );

    const error = await createApiClient(makeUser())
      .json('/reports')
      .catch(e => e);

    expect(error).toBeInstanceOf(ClientApiError);
    expect(error).toMatchObject({ status: 403, code: 'teacher role required', message: 'Solo profesores.' });
  });

  it('falls back to the status text, then a generic code, when the body has no error', async () => {
    mockFetch.mockResolvedValueOnce(response(500, {}, { json: () => Promise.reject(new Error('not json')) }));
    await expect(createApiClient(makeUser()).send('/x')).rejects.toMatchObject({ status: 500, code: 'status 500', message: 'No se pudo completar la solicitud.' });

    mockFetch.mockResolvedValueOnce(response(502, {}, { statusText: '', json: () => Promise.resolve({}) }));
    await expect(createApiClient(makeUser()).send('/x')).rejects.toMatchObject({ code: 'http_502' });
  });

  it('localizes fetch network failures dynamically while retaining retry and diagnostic information', async () => {
    setCurrentLanguage('es');
    const original = new TypeError('Failed to fetch');
    mockFetch.mockRejectedValueOnce(original);
    const error = await createApiClient(makeUser()).raw('/x').catch(e => e);
    expect(error.message).toBe('No se pudo completar la solicitud.');
    setCurrentLanguage('en');
    expect(error.message).toBe('The request could not be completed.');
    expect(error).toBeInstanceOf(TypeError);
    expect(error.cause).toBe(original);
    expect(error.cause.stack).toBe(original.stack);
    expect(isPermanentClientError(error)).toBe(false);
    setCurrentLanguage('es');
  });

  it('localizes Firebase token errors dynamically without changing identity, code or diagnostics', async () => {
    setCurrentLanguage('es');
    const original = new FirebaseError('auth/network-request-failed', 'Firebase network failure');
    const stack = original.stack;
    const user = { getIdToken: jest.fn().mockRejectedValue(original) };
    const error = await createApiClient(user).raw('/x', { forceRefresh: true }).catch(e => e);
    expect(error).toBe(original);
    expect(error.code).toBe('auth/network-request-failed');
    expect(error.message).toBe('No se pudo verificar tu sesión. Inténtalo de nuevo.');
    setCurrentLanguage('en');
    expect(error.message).toBe('Your session could not be verified. Try again.');
    expect(error.stack).toBe(stack);
    expect(isPermanentClientError(error)).toBe(false);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
    expect(mockFetch).not.toHaveBeenCalled();
    setCurrentLanguage('es');
  });

  it('preserves immutable Firebase errors, non-auth Firebase errors and token aborts unchanged', async () => {
    const frozen = Object.freeze(new FirebaseError('auth/user-token-expired', 'expired'));
    const other = new FirebaseError('storage/unknown', 'other');
    const abort = new FirebaseError('auth/network-request-failed', 'aborted');
    Object.defineProperty(abort, 'name', { value: 'AbortError' });
    for (const original of [frozen, other, abort]) {
      const message = original.message;
      const user = { getIdToken: jest.fn().mockRejectedValue(original) };
      await expect(createApiClient(user).raw('/x')).rejects.toBe(original);
      expect(original.message).toBe(message);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('preserves token failures, aborts and non-network fetch rejections', async () => {
    const tokenError = new TypeError('token failed');
    const user = { getIdToken: jest.fn().mockRejectedValue(tokenError) };
    await expect(createApiClient(user).raw('/x')).rejects.toBe(tokenError);
    expect(mockFetch).not.toHaveBeenCalled();
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abort);
    await expect(createApiClient(makeUser()).request('/x')).rejects.toBe(abort);
    const other = new Error('other failure');
    mockFetch.mockRejectedValueOnce(other);
    await expect(createApiClient(makeUser()).send('/x')).rejects.toBe(other);
  });

  it('exposes blob() and ignores the body in send()', async () => {
    mockFetch.mockResolvedValue(response(200));

    await expect(createApiClient(makeUser()).blob('/file')).resolves.toBeInstanceOf(Blob);
    await expect(createApiClient(makeUser()).send('/x')).resolves.toBeUndefined();
  });
});

describe('localized API errors', () => {
  afterEach(() => setCurrentLanguage('es'));

  it.each([
    ['scheduledAtMs in the past', 'You cannot schedule a class in the past.'],
    ['recording was not active', 'Recording was not active when this class ended.'],
    ['file too large', 'The file exceeds the permitted size.'],
    ['stale_cursor', 'The inbox changed; refresh the first page.'],
  ])('translates actionable code %s without changing retry policy', async (code, expected) => {
    setCurrentLanguage('en');
    const error = await throwOnErrorResponse(response(400, { error: { message: code, explanation: 'Explicación.' } }) as any).catch(e => e);
    expect(error.message).toBe(expected);
    expect(error.code).toBe(code);
    expect(isPermanentClientError(error)).toBe(true);
  });

  it.each([
    ['La foto supera el tamaño máximo permitido (2 MB).', 'The photo exceeds the maximum size (2 MB).'],
    ['El archivo supera el tamaño máximo permitido (25 MB).', 'The file exceeds the maximum size (25 MB).'],
  ])('retains upload limits from the server explanation', async (explanation, expected) => {
    setCurrentLanguage('en');
    const error = await throwOnErrorResponse(response(400, { error: { message: 'file too large', explanation } }) as any).catch(e => e);
    expect(error.message).toBe(expected);
  });

  it('distinguishes the same room code across token and report statuses', async () => {
    setCurrentLanguage('en');
    const error = await throwOnErrorResponse(response(404, { error: { message: 'room not found', explanation: 'No encontramos esa sesión de clase.' } }) as any).catch(e => e);
    expect(error.message).toBe('The class session was not found.');
    expect(error.status).toBe(404);
  });

  it('keeps diagnostics free of server text and permits message reassignment', async () => {
    setCurrentLanguage('en');
    const error = await throwOnErrorResponse(response(403, {
      error: { message: 'room not found', explanation: 'SECRET-SPANISH-EXPLANATION' },
    }) as any).catch(e => e);
    expect(error.message).toBe('The room is not open.');
    expect(error.stack).toContain('Error');
    expect(error.stack).not.toContain('SECRET-SPANISH-EXPLANATION');
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({ status: 403, code: 'room not found' });
    expect(JSON.stringify(error)).not.toContain('SECRET-SPANISH-EXPLANATION');
    error.message = 'Custom message';
    setCurrentLanguage('es');
    expect(error.message).toBe('Custom message');
    expect(error.stack).not.toContain('SECRET-SPANISH-EXPLANATION');
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({ status: 403, code: 'room not found' });
    expect(JSON.stringify(error)).not.toContain('Custom message');
  });

  it('keeps a Spanish response out of the stack even when language changes before stack access', async () => {
    setCurrentLanguage('es');
    const error = await throwOnErrorResponse(response(403, {
      error: { message: 'room not found', explanation: 'TEXTO-DEL-SERVIDOR' },
    }) as any).catch(e => e);
    expect(error.message).toBe('TEXTO-DEL-SERVIDOR');
    setCurrentLanguage('en');
    expect(error.message).toBe('The room is not open.');
    expect(error.stack).not.toContain('TEXTO-DEL-SERVIDOR');
    expect(error.status).toBe(403);
    expect(error.code).toBe('room not found');
  });

  it('keeps the code and status while resolving the message in the current language', async () => {
    setCurrentLanguage('es');
    const error = await throwOnErrorResponse(response(403, {
      error: { message: 'room not found', explanation: 'La sala no está abierta.' },
    }) as any).catch(e => e);
    expect(error.message).toBe('La sala no está abierta.');
    setCurrentLanguage('en');
    expect(error.message).toBe('The room is not open.');
    expect(error).toMatchObject({ code: 'room not found', status: 403 });
  });
});

describe('throwOnErrorResponse', () => {
  it('resolves for OK responses', async () => {
    await expect(throwOnErrorResponse(response(204) as any)).resolves.toBeUndefined();
  });
});

describe('withUser', () => {
  it('forwards the user and arguments to the call', async () => {
    const user = makeUser();
    const call = jest.fn((_user, a: number, b: number) => Promise.resolve(a + b));

    await expect(withUser(user, 'no user', call)(2, 3)).resolves.toBe(5);
    expect(call).toHaveBeenCalledWith(user, 2, 3);
  });

  it('rejects with the given message, without calling anything, when there is no user', async () => {
    const call = jest.fn();

    await expect(withUser(null, 'Cannot do it without an authenticated user', call)()).rejects.toEqual(
      new Error('Cannot do it without an authenticated user')
    );
    expect(call).not.toHaveBeenCalled();
  });
});
