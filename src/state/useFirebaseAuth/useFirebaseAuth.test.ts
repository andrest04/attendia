import useFirebaseAuth from './useFirebaseAuth';
import { act, renderHook } from '@testing-library/react-hooks';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';

const mockUser: any = {
  displayName: 'Test User',
  email: 'test@example.com',
  getIdToken: jest.fn(() => Promise.resolve('idToken')),
};

// Captured onAuthStateChanged callback so each test drives the initial auth state.
let mockAuthStateCallback: Function;

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => {
  const mockAuth = () => ({
    onAuthStateChanged: (fn: Function) => {
      mockAuthStateCallback = fn;
    },
    signOut: jest.fn(() => Promise.resolve()),
  });
  return {
    getAuth: mockAuth,
    signInWithPopup: jest.fn(() => Promise.resolve({ user: mockUser })),
    GoogleAuthProvider: jest.fn(() => ({ addScope: jest.fn() })),
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: mockUser })),
    createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: mockUser })),
    updateProfile: jest.fn(() => Promise.resolve()),
  };
});

const mockProfile = { displayName: 'Test User', email: 'test@example.com', role: 'student' };

const profileResponse = (status: number, body: any = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

const mockFetch = jest.fn();
// @ts-ignore
window.fetch = mockFetch;

describe('the useFirebaseAuth hook', () => {
  afterEach(jest.clearAllMocks);

  it('should expose the user and their profile once the initial auth state settles', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result } = renderHook(() => useFirebaseAuth());
    expect(result.current.isAuthReady).toBe(false);
    expect(result.current.user).toBe(null);

    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });

    expect(result.current.isAuthReady).toBe(true);
    expect(result.current.user).toBe(mockUser);
    expect(result.current.profile).toEqual(mockProfile);
    expect(mockFetch).toHaveBeenCalledWith('/profile', { headers: { Authorization: 'idToken' } });
  });

  it('should keep the profile null when GET /profile returns 404 (needs role completion)', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(404));
    const { result } = renderHook(() => useFirebaseAuth());

    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });

    expect(result.current.isAuthReady).toBe(true);
    expect(result.current.user).toBe(mockUser);
    expect(result.current.profile).toBe(null);
  });

  it('should become ready with no user or profile when signed out on load', async () => {
    const { result } = renderHook(() => useFirebaseAuth());

    await act(async () => {
      await mockAuthStateCallback(null);
    });

    expect(result.current.isAuthReady).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.profile).toBe(null);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should set the user and profile after a Google signIn', async () => {
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(null);
    });

    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.user).toBe(mockUser);
    expect(result.current.profile).toEqual(mockProfile);
  });

  it('should sign in with email and password and fetch the profile', async () => {
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(null);
    });

    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    await act(async () => {
      await result.current.signInWithEmail('test@example.com', 'password1');
    });

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password1');
    expect(result.current.user).toBe(mockUser);
    expect(result.current.profile).toEqual(mockProfile);
  });

  it('should propagate email sign-in failures (e.g. invalid credentials)', async () => {
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(null);
    });

    (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce({ code: 'auth/invalid-credential' });

    await act(async () => {
      await expect(result.current.signInWithEmail('test@example.com', 'nope')).rejects.toEqual({
        code: 'auth/invalid-credential',
      });
    });

    expect(result.current.user).toBe(null);
  });

  it('should register: create the user, set the displayName and POST the profile', async () => {
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(null);
    });

    const createdProfile = { displayName: 'New Teacher', email: 'test@example.com', role: 'teacher' };
    mockFetch.mockResolvedValueOnce(profileResponse(201, createdProfile));

    await act(async () => {
      await result.current.register('New Teacher', 'test@example.com', 'password1', 'teacher');
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password1');
    expect(updateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'New Teacher' });
    expect(mockFetch).toHaveBeenCalledWith('/profile', {
      method: 'POST',
      headers: { Authorization: 'idToken', 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Teacher', role: 'teacher' }),
    });
    expect(result.current.user).toBe(mockUser);
    expect(result.current.profile).toEqual(createdProfile);
  });

  it('should still expose the user when the register profile write fails', async () => {
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(null);
    });

    mockFetch.mockResolvedValueOnce(
      profileResponse(503, { error: { message: 'profile save failed', explanation: 'No pudimos guardar tu perfil.' } })
    );

    await act(async () => {
      await expect(result.current.register('New Teacher', 'test@example.com', 'password1', 'teacher')).rejects.toEqual(
        new Error('No pudimos guardar tu perfil.')
      );
    });

    // The Firebase account exists either way; the completion step can retry the write.
    expect(result.current.user).toBe(mockUser);
    expect(result.current.profile).toBe(null);
  });

  it('should complete a first-time Google profile with the user displayName', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(404));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    expect(result.current.profile).toBe(null);

    const createdProfile = { displayName: 'Test User', email: 'test@example.com', role: 'student' };
    mockFetch.mockResolvedValueOnce(profileResponse(201, createdProfile));

    await act(async () => {
      await result.current.completeProfile('student');
    });

    expect(mockFetch).toHaveBeenLastCalledWith('/profile', {
      method: 'POST',
      headers: { Authorization: 'idToken', 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Test User', role: 'student' }),
    });
    expect(result.current.profile).toEqual(createdProfile);
  });

  it('should clear the user and profile on signOut', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    expect(result.current.profile).toEqual(mockProfile);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthReady).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.profile).toBe(null);
  });

  it('should include the users idToken in requests to the video token server and reject on non-OK', async () => {
    process.env.REACT_APP_TOKEN_ENDPOINT = 'http://test-endpoint.com/token';
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });

    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'mockVideoToken' }) });
    await result.current.getToken('testuser', 'testroom');

    expect(mockFetch).toHaveBeenLastCalledWith(
      'http://test-endpoint.com/token',
      expect.objectContaining({
        method: 'POST',
        body: '{"user_identity":"testuser","room_name":"testroom","create_conversation":true}',
      })
    );

    mockFetch.mockResolvedValueOnce(
      profileResponse(403, { error: { message: 'room not found', explanation: 'La sala todavía no está abierta.' } })
    );
    await expect(result.current.getToken('testuser', 'testroom')).rejects.toEqual(
      new Error('La sala todavía no está abierta.')
    );

    delete process.env.REACT_APP_TOKEN_ENDPOINT;
  });
});
