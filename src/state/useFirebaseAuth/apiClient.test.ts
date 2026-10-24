import { ClientApiError, createApiClient, throwOnErrorResponse, withUser } from './apiClient';
import { setLocale } from '../../i18n/locale';

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
  afterEach(() => window.localStorage.clear());

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
    await expect(createApiClient(makeUser()).send('/x')).rejects.toMatchObject({ status: 500, message: 'status 500' });

    mockFetch.mockResolvedValueOnce(response(502, {}, { statusText: '', json: () => Promise.resolve({}) }));
    await expect(createApiClient(makeUser()).send('/x')).rejects.toMatchObject({ code: 'http_502' });
  });

  it('exposes blob() and ignores the body in send()', async () => {
    mockFetch.mockResolvedValue(response(200));

    await expect(createApiClient(makeUser()).blob('/file')).resolves.toBeInstanceOf(Blob);
    await expect(createApiClient(makeUser()).send('/x')).resolves.toBeUndefined();
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
