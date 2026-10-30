import { setLocale } from '../../i18n/locale';
import { ClientApiError, createApiClient, isPermanentClientError, throwOnErrorResponse, withUser } from './apiClient';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
import { FirebaseError } from 'firebase/app';
import completeErrorsEn from '../../i18n/locales/completeErrors.en';
import completeErrorsEs from '../../i18n/locales/completeErrors.es';

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
  beforeEach(() => {
    mockFetch.mockReset();
    setLocale('es');
  });
  afterEach(() => {
    setLocale('es');
    window.localStorage.clear();
  });

  it('sends the selected language on Accept-Language', async () => {
    setLocale('en');
    mockFetch.mockResolvedValueOnce(response(200, {}));

    await createApiClient(makeUser()).send('/thing');

    expect(mockFetch).toHaveBeenCalledWith('/thing', {
      headers: { Authorization: 'idToken', 'Accept-Language': 'en' },
    });
  });

  it('sends a GET with the Authorization and Accept-Language headers (no method key)', async () => {
    const user = makeUser();
    mockFetch.mockResolvedValueOnce(response(200, { a: 1 }));

    await expect(createApiClient(user).json('/thing')).resolves.toEqual({ a: 1 });

    expect(mockFetch).toHaveBeenCalledWith('/thing', {
      headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
    });
    expect(user.getIdToken).toHaveBeenCalledWith();
  });

  it('serializes a JSON body with the matching content-type', async () => {
    mockFetch.mockResolvedValueOnce(response(201, {}));

    await createApiClient(makeUser()).json('/thing', { method: 'POST', json: { b: 2 } });

    expect(mockFetch).toHaveBeenCalledWith('/thing', {
      method: 'POST',
      headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'content-type': 'application/json' },
      body: '{"b":2}',
    });
  });

  it('passes a raw body (FormData) through without forcing a content-type', async () => {
    const form = new FormData();
    mockFetch.mockResolvedValueOnce(response(200));

    await createApiClient(makeUser()).json('/upload', { method: 'POST', body: form });

    expect(mockFetch).toHaveBeenCalledWith('/upload', {
      method: 'POST',
      headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
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
      headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'Idempotency-Key': 'k1' },
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

  it('has a Spanish mapping for every known English error code', () => {
    expect(Object.keys(completeErrorsEn).filter(code => !Object.prototype.hasOwnProperty.call(completeErrorsEs, code))).toEqual([]);
  });

  it.each([
    [400, 'scheduledAtMs in the past', 'You cannot schedule a class in the past.', 'No puedes programar una clase en el pasado.'],
    [400, 'stale_cursor', 'The inbox changed; refresh the first page.', 'La bandeja cambió; actualiza la primera página.'],
    [400, 'recording was not active', 'Recording was not active when this class ended.', 'La grabación no estaba activa cuando terminó esta clase.'],
    [403, 'room not found', 'The room is not open.', 'La sala no está abierta.'],
    [404, 'room not found', 'The class session was not found.', 'No encontramos esa sesión de clase.'],
    [413, 'file too large', 'The file exceeds the maximum size (25 MB).', 'El archivo supera el tamaño máximo permitido (25 MB).'],
    [503, 'unknown code', 'Untrusted detail', 'No se pudo completar la solicitud.'],
  ])('resolves an English request error %s %s in Spanish', async (status, code, explanation, expected) => {
    setCurrentLanguage('en');
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(response(status, { error: { message: code, explanation } }));
    const error = await createApiClient(makeUser()).send('/x').catch(e => e);
    expect(mockFetch.mock.calls[0][1].headers['Accept-Language']).toBe('en');
    setCurrentLanguage('es');
    expect(error).toMatchObject({ status, code, message: expected });
    expect(isPermanentClientError(error)).toBe([400, 403, 404, 413].includes(status));
  });

  it('localizes an English response after switching to Spanish, including contextual and unknown errors', async () => {
    setCurrentLanguage('en');
    const errors = await Promise.all([
      throwOnErrorResponse(response(404, { error: { message: 'room not found', explanation: 'The class session was not found.' } }) as any).catch(e => e),
      throwOnErrorResponse(response(413, { error: { message: 'file too large', explanation: 'The photo exceeds the maximum size (2 MB).' } }) as any).catch(e => e),
      throwOnErrorResponse(response(503, { error: { message: 'unknown code', explanation: 'Internal English detail' } }) as any).catch(e => e),
    ]);
    setCurrentLanguage('es');
    expect(errors[0]).toMatchObject({ status: 404, code: 'room not found', message: 'No encontramos esa sesión de clase.' });
    expect(errors[1]).toMatchObject({ status: 413, code: 'file too large', message: 'La foto supera el tamaño máximo permitido (2 MB).' });
    expect(errors[2]).toMatchObject({ status: 503, code: 'unknown code', message: 'No se pudo completar la solicitud.' });
    expect(errors[2].stack).not.toContain('Internal English detail');
    setCurrentLanguage('en');
    expect(errors[0].message).toBe('The class session was not found.');
  });

  it('uses the request language when the UI changes before the response arrives', async () => {
    setCurrentLanguage('en');
    let resolveFetch: (value: any) => void = () => {};
    let signalStarted: () => void = () => {};
    const started = new Promise<void>(resolve => { signalStarted = resolve; });
    mockFetch.mockImplementationOnce(() => new Promise(resolve => { resolveFetch = resolve; signalStarted(); }));
    const pending = createApiClient(makeUser()).send('/x').catch(e => e);
    await started;
    setCurrentLanguage('es');
    resolveFetch(response(403, { error: { message: 'teacher role required', explanation: 'English explanation' } }));
    const error = await pending;
    expect(error.message).toBe('Se necesita una cuenta de profesor para esta acción.');
  });

  it('preserves caller-provided direct messages but does not trust external responses of unknown language', async () => {
    setCurrentLanguage('es');
    const direct = new ClientApiError(503, 'unknown', 'Caller explanation');
    const external = await throwOnErrorResponse(response(503, { error: { message: 'unknown', explanation: 'English server detail' } }) as any).catch(e => e);
    expect(direct.message).toBe('Caller explanation');
    setCurrentLanguage('en');
    expect(direct.message).toBe('The request could not be completed.');
    setCurrentLanguage('es');
    expect(external.message).toBe('No se pudo completar la solicitud.');
    expect(external).toMatchObject({ status: 503, code: 'unknown' });
  });

  it('preserves an explicitly Spanish explanation across language switches', async () => {
    setCurrentLanguage('es');
    const error = await throwOnErrorResponse(response(503, { error: { message: 'unknown', explanation: 'Detalle en español.' } }) as any, 'es').catch(e => e);
    expect(error.message).toBe('Detalle en español.');
    setCurrentLanguage('en');
    expect(error.message).toBe('The request could not be completed.');
    setCurrentLanguage('es');
    expect(error.message).toBe('Detalle en español.');
  });

  it('preserves a direct Spanish explanation and translates known codes when switching to English', () => {
    setCurrentLanguage('es');
    const error = new ClientApiError(403, 'teacher role required', 'Explicación del llamador.');
    expect(error).toMatchObject({ status: 403, code: 'teacher role required', message: 'Explicación del llamador.' });
    setCurrentLanguage('en');
    expect(error.message).toBe('A teacher account is required for this action.');
    setCurrentLanguage('es');
    expect(error.message).toBe('Explicación del llamador.');
  });

  it('uses a safe fallback for a direct error explicitly lacking an explanation', () => {
    setCurrentLanguage('es');
    expect(new ClientApiError(500, 'Internal server error', 'Internal server error', false).message)
      .toBe('No se pudo completar la solicitud.');
  });

  it.each([
    ['scheduledAtMs in the past', 'You cannot schedule a class in the past.'],
    ['recording was not active', 'Recording was not active when this class ended.'],
    ['file too large', 'The file exceeds the permitted size.'],
    ['stale_cursor', 'The inbox changed; refresh the first page.'],
    ['invalid attentionThreshold', 'The attention threshold is invalid.'],
    ['invalid groupAverage', 'The group average is invalid.'],
    ['invalid percentAboveThreshold', 'The percentage above the threshold is invalid.'],
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
    }) as any, 'es').catch(e => e);
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
    }) as any, 'es').catch(e => e);
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
