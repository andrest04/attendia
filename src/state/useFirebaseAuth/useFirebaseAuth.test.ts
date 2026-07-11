import useFirebaseAuth from './useFirebaseAuth';
import { act, renderHook } from '@testing-library/react-hooks';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from 'firebase/auth';

const mockUser: any = {
  uid: 'uid-1',
  displayName: 'Test User',
  email: 'test@example.com',
  getIdToken: jest.fn(() => Promise.resolve('idToken')),
  providerData: [{ providerId: 'password' }],
  reload: jest.fn(() => Promise.resolve()),
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
    currentUser: mockUser,
  });
  return {
    getAuth: mockAuth,
    signInWithPopup: jest.fn(() => Promise.resolve({ user: mockUser })),
    GoogleAuthProvider: jest.fn(() => ({ addScope: jest.fn() })),
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: mockUser })),
    createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: mockUser })),
    updateProfile: jest.fn(() => Promise.resolve()),
    EmailAuthProvider: { credential: jest.fn(() => 'mockEmailCredential') },
    linkWithCredential: jest.fn(() => Promise.resolve({ user: mockUser })),
    reauthenticateWithCredential: jest.fn(() => Promise.resolve()),
    reauthenticateWithPopup: jest.fn(() => Promise.resolve({ user: mockUser })),
    updatePassword: jest.fn(() => Promise.resolve()),
    updateEmail: jest.fn(() => Promise.resolve()),
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
  afterEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUser.displayName = 'Test User';
    mockUser.email = 'test@example.com';
  });

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

  it('should link an email/password credential built from the current user email on createPassword', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });

    const linkedUser: any = { ...mockUser, providerData: [{ providerId: 'password' }] };
    (linkWithCredential as jest.Mock).mockResolvedValueOnce({ user: linkedUser });

    await act(async () => {
      await result.current.createPassword('newPassword1');
    });

    expect(EmailAuthProvider.credential).toHaveBeenCalledWith('test@example.com', 'newPassword1');
    expect(linkWithCredential).toHaveBeenCalledWith(mockUser, 'mockEmailCredential');
    expect(result.current.user).toBe(linkedUser);
    // The Firestore profile is untouched by the credential link.
    expect(result.current.profile).toEqual(mockProfile);
  });

  it('updates profile fields through the narrow PATCH endpoint', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, { ...mockProfile, role: 'teacher' }));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    const updatedProfile = { displayName: 'Updated teacher', email: 'test@example.com', role: 'teacher' };
    mockFetch.mockResolvedValueOnce(profileResponse(200, updatedProfile));

    await act(async () => {
      await result.current.updateTeacherProfile({ displayName: 'Updated teacher' });
    });

    expect(updateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'Updated teacher' });
    expect(mockFetch).toHaveBeenLastCalledWith('/profile', {
      method: 'PATCH',
      headers: { Authorization: 'idToken', 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Updated teacher' }),
    });
    expect(result.current.profile).toEqual(updatedProfile);
  });

  it('updates an avatar without mutating Firebase Auth displayName', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, { ...mockProfile, role: 'teacher' }));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    const updatedProfile = { ...mockProfile, role: 'teacher', avatarDataUrl: 'data:image/jpeg;base64,AA==' };
    mockFetch.mockResolvedValueOnce(profileResponse(200, updatedProfile));

    await act(async () => {
      await result.current.updateTeacherProfile({ avatarDataUrl: 'data:image/jpeg;base64,AA==' });
    });

    expect(updateProfile).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/profile',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ avatarDataUrl: 'data:image/jpeg;base64,AA==' }),
      })
    );
  });

  it('does not PATCH Firestore when Firebase rejects a display-name update', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, { ...mockProfile, role: 'teacher' }));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    (updateProfile as jest.Mock).mockRejectedValueOnce(new Error('auth unavailable'));
    mockFetch.mockResolvedValueOnce(profileResponse(204));

    await act(async () => {
      await expect(result.current.updateTeacherProfile({ displayName: 'Updated teacher' })).rejects.toEqual(
        new Error('auth unavailable')
      );
    });

    expect(mockFetch).not.toHaveBeenCalledWith('/profile', expect.objectContaining({ method: 'PATCH' }));
  });

  it('records a client fallback when operational event delivery receives a non-OK response', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockResolvedValueOnce(profileResponse(200, { ...mockProfile, role: 'teacher' }));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    (updateProfile as jest.Mock).mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    mockFetch.mockResolvedValueOnce(profileResponse(503));

    await act(async () => {
      await expect(result.current.updateTeacherProfile({ displayName: 'Updated teacher' })).rejects.toEqual({
        code: 'auth/network-request-failed',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        level: 'error',
        event: 'operational_failure',
        operation: 'profile_auth_display_name_update',
        failure: 'auth/network-request-failed',
      })
    );
    consoleError.mockRestore();
  });

  it('records a client fallback when operational event delivery rejects', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockResolvedValueOnce(profileResponse(200, { ...mockProfile, role: 'teacher' }));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    (updateProfile as jest.Mock).mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    mockFetch.mockRejectedValueOnce(new Error('network unavailable'));

    await act(async () => {
      await expect(result.current.updateTeacherProfile({ displayName: 'Updated teacher' })).rejects.toEqual({
        code: 'auth/network-request-failed',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        level: 'error',
        event: 'operational_failure',
        operation: 'profile_auth_display_name_update',
        failure: 'auth/network-request-failed',
      })
    );
    consoleError.mockRestore();
  });

  it('rolls Firebase displayName back when the Firestore PATCH fails', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, { ...mockProfile, role: 'teacher' }));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    mockFetch.mockResolvedValueOnce(profileResponse(503, { error: { explanation: 'Firestore no disponible.' } }));
    mockFetch.mockResolvedValueOnce(profileResponse(204));

    await act(async () => {
      await expect(result.current.updateTeacherProfile({ displayName: 'Updated teacher' })).rejects.toEqual(
        new Error('Firestore no disponible.')
      );
    });

    expect(updateProfile).toHaveBeenNthCalledWith(1, mockUser, { displayName: 'Updated teacher' });
    expect(updateProfile).toHaveBeenNthCalledWith(2, mockUser, { displayName: 'Test User' });
  });

  it('reauthenticates password users before changing their email and their password', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });

    const updatedProfile = { displayName: 'Test User', email: 'new@example.com', role: 'student' };
    mockFetch.mockResolvedValueOnce(profileResponse(200, updatedProfile));

    await act(async () => {
      await expect(result.current.changeEmail('new@example.com', 'current-password')).resolves.toEqual(updatedProfile);
      await result.current.changePassword('current-password', 'new-password');
    });

    expect(reauthenticateWithCredential).toHaveBeenCalledWith(mockUser, 'mockEmailCredential');
    expect(updateEmail).toHaveBeenCalledWith(mockUser, 'new@example.com');
    expect(mockFetch).toHaveBeenCalledWith('/profile', {
      method: 'PATCH',
      headers: { Authorization: 'idToken', 'content-type': 'application/json' },
      body: JSON.stringify({ syncEmail: true }),
    });
    expect(updatePassword).toHaveBeenCalledWith(mockUser, 'new-password');
  });

  it('should reject createPassword when there is no signed-in user', async () => {
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(null);
    });

    await act(async () => {
      await expect(result.current.createPassword('newPassword1')).rejects.toEqual(
        new Error('Cannot create a password without an authenticated user with an email')
      );
    });

    expect(linkWithCredential).not.toHaveBeenCalled();
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

  describe('the "Recursos" resource endpoints', () => {
    const mockResource = {
      id: 'res-1',
      name: 'guia.pdf',
      kind: 'pdf',
      roomLabel: 'Cálculo I',
      sizeBytes: 2048,
      contentType: 'application/pdf',
      createdAtMs: 1751554800000,
    };

    async function signIn() {
      mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
      const { result } = renderHook(() => useFirebaseAuth());
      await act(async () => {
        await mockAuthStateCallback(mockUser);
      });
      return result;
    }

    it('fetches the resources list with the idToken', async () => {
      const result = await signIn();
      mockFetch.mockResolvedValueOnce(profileResponse(200, [mockResource]));

      const resources = await result.current.fetchResources();

      expect(mockFetch).toHaveBeenLastCalledWith('/resources', { headers: { Authorization: 'idToken' } });
      expect(resources).toEqual([mockResource]);
    });

    it('rejects fetchResources when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.fetchResources()).rejects.toEqual(
        new Error('Cannot fetch resources without an authenticated user')
      );
    });

    it('uploads a file as multipart form data with the idToken and classId', async () => {
      const result = await signIn();
      mockFetch.mockResolvedValueOnce(profileResponse(201, mockResource));
      const file = new File(['contenido'], 'guia.pdf', { type: 'application/pdf' });

      const created = await result.current.uploadResource(file, 'class-1');

      expect(created).toEqual(mockResource);
      const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(url).toBe('/resources');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ Authorization: 'idToken' });
      expect(init.body).toBeInstanceOf(FormData);
      expect(init.body.get('classId')).toBe('class-1');
      expect(init.body.get('file')).toBe(file);
    });

    it('rejects uploadResource when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());
      const file = new File(['contenido'], 'guia.pdf', { type: 'application/pdf' });

      await expect(result.current.uploadResource(file, 'Cálculo I')).rejects.toEqual(
        new Error('Cannot upload a resource without an authenticated user')
      );
    });

    it('resolves the base64 content, contentType and name with the idToken', async () => {
      const result = await signIn();
      const downloadBody = { content: 'YmFzZTY0...', contentType: 'application/pdf', name: 'guia.pdf' };
      mockFetch.mockResolvedValueOnce(profileResponse(200, downloadBody));

      const download = await result.current.fetchResourceDownloadUrl('res-1');

      expect(mockFetch).toHaveBeenLastCalledWith('/resources/res-1/download', {
        headers: { Authorization: 'idToken' },
      });
      expect(download).toEqual(downloadBody);
    });

    it('rejects fetchResourceDownloadUrl when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.fetchResourceDownloadUrl('res-1')).rejects.toEqual(
        new Error('Cannot download a resource without an authenticated user')
      );
    });

    it('deletes a resource with the idToken', async () => {
      const result = await signIn();
      mockFetch.mockResolvedValueOnce(profileResponse(200, { deleted: true }));

      await result.current.deleteResource('res-1');

      expect(mockFetch).toHaveBeenLastCalledWith('/resources/res-1', {
        method: 'DELETE',
        headers: { Authorization: 'idToken' },
      });
    });

    it('rejects deleteResource when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.deleteResource('res-1')).rejects.toEqual(
        new Error('Cannot delete a resource without an authenticated user')
      );
    });
  });
});
