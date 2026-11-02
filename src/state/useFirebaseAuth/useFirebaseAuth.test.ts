import useFirebaseAuth from './useFirebaseAuth';
import AppStateProvider, { useAppState } from '../index';
import { getLocale, setLocale, Locale } from '../../i18n/locale';
import testI18n from '../../i18n/testInit';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
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
  FirebaseError: jest.requireActual('firebase/app').FirebaseError,
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

// AppStateProvider's audio-output hook needs navigator.mediaDevices, which jsdom lacks.
jest.mock('../useActiveSinkId/useActiveSinkId', () => ({ __esModule: true, default: () => ['default', () => {}] }));

const mockProfile = { displayName: 'Test User', email: 'test@example.com', role: 'student' };

const profileResponse = (status: number, body: any = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

const mockFetch = jest.fn();
// @ts-ignore
window.fetch = mockFetch;

// Minimal fake XHR for uploadResource, which uses XMLHttpRequest (not fetch) to get
// upload-progress events. Tests drive it by grabbing the latest instance from
// mockXhrInstances and manually firing upload.onprogress / onload.
class MockXHR {
  method = '';
  url = '';
  requestHeaders: Record<string, string> = {};
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  status = 0;
  statusText = '';
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  body: any;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  send(body: any) {
    this.body = body;
    mockXhrInstances.push(this);
  }
}
let mockXhrInstances: MockXHR[] = [];
// @ts-ignore
window.XMLHttpRequest = MockXHR;

describe('the useFirebaseAuth hook', () => {
  let previousLocale: Locale;
  beforeEach(() => {
    previousLocale = getLocale();
    setLocale('es');
  });
  afterEach(() => {
    setLocale(previousLocale);
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUser.displayName = 'Test User';
    mockUser.email = 'test@example.com';
    mockXhrInstances = [];
  });

  it('localizes token failures before starting a resource upload', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result, unmount } = renderHook(() => useFirebaseAuth());
    await act(async () => { await mockAuthStateCallback(mockUser); });
    const { FirebaseError } = jest.requireActual('firebase/app');
    const original = new FirebaseError('auth/network-request-failed', 'Firebase network failure');
    mockUser.getIdToken.mockRejectedValueOnce(original);
    setCurrentLanguage('es');
    const error = await result.current.uploadResource(new File(['x'], 'x.txt'), 'class').catch(e => e);
    expect(error).toBe(original);
    expect(error.code).toBe('auth/network-request-failed');
    expect(error.message).toBe('No se pudo verificar tu sesión. Inténtalo de nuevo.');
    setCurrentLanguage('en');
    expect(error.message).toBe('Your session could not be verified. Try again.');
    expect(mockXhrInstances).toHaveLength(0);
    unmount();
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
    expect(mockFetch).toHaveBeenCalledWith('/profile', {
      headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
    });
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

  it('should reject a non-OK recording-rules response before treating its body as success', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result } = renderHook(() => useFirebaseAuth());

    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ error: { explanation: 'No tienes permiso para cambiar la grabación.' } }),
    });

    await act(async () => {
      await expect(result.current.updateRecordingRules('RM123', [])).rejects.toThrow(
        'No tienes permiso para cambiar la grabación.'
      );
    });
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
      headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'content-type': 'application/json' },
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
      headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'content-type': 'application/json' },
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
      headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Updated teacher' }),
    });
    expect(result.current.profile).toEqual(updatedProfile);
  });

  it('uploads an avatar via multipart form data and applies the returned profile', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, { ...mockProfile, role: 'teacher' }));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    const updatedProfile = { ...mockProfile, role: 'teacher', avatarUrl: 'https://appwrite.example/avatar-1' };
    mockFetch.mockResolvedValueOnce(profileResponse(200, updatedProfile));
    const file = new File(['bytes'], 'avatar.jpg', { type: 'image/jpeg' });

    let returned: any;
    await act(async () => {
      returned = await result.current.uploadAvatar(file);
    });

    expect(returned).toEqual(updatedProfile);
    expect(result.current.profile).toEqual(updatedProfile);
    const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(url).toBe('/profile/avatar');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'idToken', 'Accept-Language': 'es' });
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('file')).toBe(file);
  });

  it('rejects uploadAvatar when there is no signed-in user', async () => {
    const { result } = renderHook(() => useFirebaseAuth());
    const file = new File(['bytes'], 'avatar.jpg', { type: 'image/jpeg' });

    await expect(result.current.uploadAvatar(file)).rejects.toEqual(
      new Error('Inicia sesión para continuar.')
    );
  });

  it('deletes an avatar and applies the returned profile', async () => {
    mockFetch.mockResolvedValueOnce(
      profileResponse(200, { ...mockProfile, role: 'teacher', avatarUrl: 'https://appwrite.example/avatar-1' })
    );
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });
    const updatedProfile = { ...mockProfile, role: 'teacher' };
    mockFetch.mockResolvedValueOnce(profileResponse(200, updatedProfile));

    let returned: any;
    await act(async () => {
      returned = await result.current.deleteAvatar();
    });

    expect(returned).toEqual(updatedProfile);
    expect(result.current.profile).toEqual(updatedProfile);
    expect(mockFetch).toHaveBeenLastCalledWith('/profile/avatar', {
      method: 'DELETE',
      headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
    });
  });

  it('rejects deleteAvatar when there is no signed-in user', async () => {
    const { result } = renderHook(() => useFirebaseAuth());

    await expect(result.current.deleteAvatar()).rejects.toEqual(
      new Error('Inicia sesión para continuar.')
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
      headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'content-type': 'application/json' },
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
        new Error('Inicia sesión para continuar.')
      );
    });

    expect(linkWithCredential).not.toHaveBeenCalled();
  });

  it('localizes the recording request guard in both languages without making a request', async () => {
    await testI18n.changeLanguage('es');
    const { result, unmount } = renderHook(() => useFirebaseAuth(), {
      wrapper: ({ children }) => React.createElement(I18nextProvider, { i18n: testI18n }, children),
    });
    const callbacks = {
      getToken: result.current.getToken,
      fetchResources: result.current.fetchResources,
      fetchClasses: result.current.fetchClasses,
      fetchAttentionReports: result.current.fetchAttentionReports,
      requestRecordingArtifact: result.current.requestRecordingArtifact,
    };
    const error = await result.current.requestRecordingArtifact('RM123').catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Inicia sesión para solicitar una grabación.');
    const resourceError = await result.current.fetchResources().catch(e => e);
    expect(resourceError.message).toBe('Inicia sesión para continuar.');
    expect(mockFetch).not.toHaveBeenCalled();
    await act(async () => { await testI18n.changeLanguage('en'); });
    expect(error.message).toBe('Sign in to request a recording.');
    expect(resourceError.message).toBe('Sign in to continue.');
    expect(result.current.getToken).toBe(callbacks.getToken);
    expect(result.current.fetchResources).toBe(callbacks.fetchResources);
    expect(result.current.fetchClasses).toBe(callbacks.fetchClasses);
    expect(result.current.fetchAttentionReports).toBe(callbacks.fetchAttentionReports);
    expect(result.current.requestRecordingArtifact).toBe(callbacks.requestRecordingArtifact);
    expect(error.stack).toContain('Error');
    expect(JSON.stringify(error)).toBe('{}');
    error.message = 'Overridden';
    expect(error.message).toBe('Overridden');
    const englishError = await result.current.requestRecordingArtifact('RM123').catch(e => e);
    expect(englishError.message).toBe('Sign in to request a recording.');
    expect(mockFetch).not.toHaveBeenCalled();
    unmount();
    await testI18n.changeLanguage('es');
  });

  it('rejects token requests without a user in both languages without accessing the network', async () => {
    await testI18n.changeLanguage('es');
    const { result, unmount } = renderHook(() => useFirebaseAuth(), {
      wrapper: ({ children }) => React.createElement(I18nextProvider, { i18n: testI18n }, children),
    });
    const error = await result.current.getToken('name', 'room').catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Inicia sesión para continuar.');
    expect(mockFetch).not.toHaveBeenCalled();
    await act(async () => { await testI18n.changeLanguage('en'); });
    expect(error.message).toBe('Sign in to continue.');
    expect((await result.current.getToken('name', 'room').catch(e => e)).message).toBe('Sign in to continue.');
    expect(mockFetch).not.toHaveBeenCalled();
    unmount();
    await testI18n.changeLanguage('es');
  });

  it('keeps resource loaders stable across signed-in rerenders', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result, rerender } = renderHook(() => useFirebaseAuth());
    await act(async () => { await mockAuthStateCallback(mockUser); });
    const fetchClasses = result.current.fetchClasses;
    const fetchResources = result.current.fetchResources;
    const fetchReports = result.current.fetchAttentionReports;
    const fetchCount = mockFetch.mock.calls.length;
    rerender();
    expect(result.current.fetchClasses).toBe(fetchClasses);
    expect(result.current.fetchResources).toBe(fetchResources);
    expect(result.current.fetchAttentionReports).toBe(fetchReports);
    expect(mockFetch).toHaveBeenCalledTimes(fetchCount);
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

  it('posts the class reconcile with the idToken and returns how many classes it completed', async () => {
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });

    mockFetch.mockResolvedValueOnce(profileResponse(200, { completed: 3 }));
    await expect(result.current.reconcileClasses()).resolves.toEqual({ completed: 3 });

    const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(url).toBe('/classes/reconcile');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('idToken');
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

    setCurrentLanguage('en');
    mockFetch.mockResolvedValueOnce(profileResponse(409, { error: { message: 'identity in use', explanation: 'This name is already in use in the room.' } }));
    const tokenError = await result.current.getToken('testuser', 'testroom').catch(e => e);
    expect(tokenError).toMatchObject({ status: 409, code: 'identity in use', message: 'This name is already in use in the room.' });
    setCurrentLanguage('es');
    expect(tokenError.message).toBe('Ese nombre ya está en uso en esta clase por otra cuenta. Elegí otro nombre para entrar.');
    delete process.env.REACT_APP_TOKEN_ENDPOINT;
  });

  it('should send create_room:false only on a join-only token request', async () => {
    process.env.REACT_APP_TOKEN_ENDPOINT = 'http://test-endpoint.com/token';
    mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
    const { result } = renderHook(() => useFirebaseAuth());
    await act(async () => {
      await mockAuthStateCallback(mockUser);
    });

    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'mockVideoToken' }) });
    await result.current.getToken('testuser', 'testroom', { joinOnly: true });

    expect(JSON.parse(mockFetch.mock.calls[mockFetch.mock.calls.length - 1][1].body)).toEqual({
      user_identity: 'testuser',
      room_name: 'testroom',
      create_room: false,
      create_conversation: true,
    });
    delete process.env.REACT_APP_TOKEN_ENDPOINT;
  });

  describe('the error dialog around a token refusal', () => {
    const roomNotOpen = () =>
      profileResponse(403, { error: { message: 'room not found', explanation: 'La sala todavía no está abierta.' } });

    const renderAppState = async () => {
      mockFetch.mockResolvedValueOnce(profileResponse(200, mockProfile));
      const { result } = renderHook(() => useAppState(), { wrapper: AppStateProvider as any });
      await act(async () => {
        await mockAuthStateCallback(mockUser);
      });
      return result;
    };

    it('stays closed when a join-only request finds the room closed, and still rejects', async () => {
      const result = await renderAppState();
      mockFetch.mockResolvedValueOnce(roomNotOpen());

      await act(async () => {
        const refusal = await result.current.getToken('testuser', 'testroom', { joinOnly: true }).catch(e => e);
        expect(refusal).toMatchObject({ status: 403, code: 'room not found' });
      });

      expect(result.current.error).toBe(null);
      expect(result.current.isFetching).toBe(false);
    });

    it('opens when a manual join finds the room closed', async () => {
      const result = await renderAppState();
      mockFetch.mockResolvedValueOnce(roomNotOpen());

      await act(async () => {
        await result.current.getToken('testuser', 'testroom').catch(() => {});
      });

      expect(result.current.error).toMatchObject({ code: 'room not found' });
    });

    it('opens for any other refusal of a join-only request', async () => {
      const result = await renderAppState();
      mockFetch.mockResolvedValueOnce(
        profileResponse(503, { error: { message: 'room verification failed', explanation: 'No pudimos verificar la sala.' } })
      );

      await act(async () => {
        await result.current.getToken('testuser', 'testroom', { joinOnly: true }).catch(() => {});
      });

      expect(result.current.error).toMatchObject({ code: 'room verification failed' });
    });
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

      expect(mockFetch).toHaveBeenLastCalledWith('/resources', {
        headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
      });
      expect(resources).toEqual([mockResource]);
    });

    it('rejects fetchResources when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.fetchResources()).rejects.toEqual(
        new Error('Inicia sesión para continuar.')
      );
    });

    it('uploads a file as multipart form data with the idToken and classId, reporting progress', async () => {
      const result = await signIn();
      const file = new File(['contenido'], 'guia.pdf', { type: 'application/pdf' });
      const onProgress = jest.fn();

      let created: any;
      const uploadPromise = result.current.uploadResource(file, 'class-1', onProgress).then(r => (created = r));

      // Let getIdToken() resolve so the XHR is opened/sent before we grab it.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const xhr = mockXhrInstances[mockXhrInstances.length - 1];
      expect(xhr.method).toBe('POST');
      expect(xhr.url).toBe('/resources');
      expect(xhr.requestHeaders).toEqual({ Authorization: 'idToken', 'Accept-Language': 'es' });
      expect(xhr.body).toBeInstanceOf(FormData);
      expect(xhr.body.get('classId')).toBe('class-1');
      expect(xhr.body.get('file')).toBe(file);

      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      expect(onProgress).toHaveBeenCalledWith(50);

      xhr.status = 201;
      xhr.responseText = JSON.stringify(mockResource);
      xhr.onload?.();
      await uploadPromise;

      expect(created).toEqual(mockResource);
    });

    it('rejects uploadResource with the server explanation on a non-OK response', async () => {
      const result = await signIn();
      const file = new File(['contenido'], 'guia.pdf', { type: 'application/pdf' });

      const uploadPromise = result.current.uploadResource(file, 'class-1');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const xhr = mockXhrInstances[mockXhrInstances.length - 1];
      xhr.status = 400;
      xhr.responseText = JSON.stringify({ error: { explanation: 'Debes seleccionar una clase programada.' } });
      xhr.onload?.();

      await expect(uploadPromise).rejects.toEqual(new Error('Debes seleccionar una clase programada.'));
    });

    it('localizes upload errors without changing the response code or status', async () => {
      const result = await signIn();
      const upload = result.current.uploadResource(new File(['x'], 'guia.pdf'), 'class-1').catch(e => e);
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      const xhr = mockXhrInstances[mockXhrInstances.length - 1];
      xhr.status = 400;
      xhr.responseText = JSON.stringify({ error: { message: 'file too large', explanation: 'Archivo demasiado grande.' } });
      xhr.onload?.();
      const error = await upload;
      expect(error).toMatchObject({ status: 400, code: 'file too large', message: 'Archivo demasiado grande.' });
      setCurrentLanguage('en');
      expect(error.message).toBe('The file exceeds the permitted size.');
    });

    it.each([
      ['en', 'es', 'English server detail', 'No se pudo completar la solicitud.'],
      ['es', 'en', 'Detalle del servidor.', 'The request could not be completed.'],
    ])('uses the sent %s language when the UI changes to %s before an upload response', async (sent, current, explanation, expected) => {
      const result = await signIn();
      setLocale(sent as Locale);
      const upload = result.current.uploadResource(new File(['x'], 'guia.pdf'), 'class-1').catch(e => e);
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      const xhr = mockXhrInstances[mockXhrInstances.length - 1];
      expect(xhr.requestHeaders['Accept-Language']).toBe(sent);
      setLocale(current as Locale);
      xhr.status = 503;
      xhr.responseText = JSON.stringify({ error: { message: 'unknown code', explanation } });
      xhr.onload?.();
      const error = await upload;
      expect(error.message).toBe(expected);
      setLocale('es');
      expect(error.message).toBe(sent === 'es' ? explanation : 'No se pudo completar la solicitud.');
    });

    it('updates an existing upload network error when the language changes', async () => {
      const result = await signIn();
      const upload = result.current.uploadResource(new File(['x'], 'guia.pdf'), 'class-1').catch(e => e);
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      mockXhrInstances[mockXhrInstances.length - 1].onerror?.();
      const error = await upload;
      expect(error.message).toBe(testI18n.t('errors:auth.uploadFailed', { lng: 'es' }));
      try {
        await act(async () => { await testI18n.changeLanguage('en'); });
        expect(error.message).toBe(testI18n.t('errors:auth.uploadFailed', { lng: 'en' }));
      } finally {
        await act(async () => { await testI18n.changeLanguage('es'); });
      }
    });

    it('rejects uploadResource when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());
      const file = new File(['contenido'], 'guia.pdf', { type: 'application/pdf' });

      await expect(result.current.uploadResource(file, 'Cálculo I')).rejects.toEqual(
        new Error('Inicia sesión para continuar.')
      );
    });

    it('resolves the binary response as a Blob with the idToken', async () => {
      const result = await signIn();
      const blob = new Blob(['contenido'], { type: 'application/pdf' });
      mockFetch.mockResolvedValueOnce({ ...profileResponse(200), blob: () => Promise.resolve(blob) });

      const download = await result.current.fetchResourceDownloadUrl('res-1');

      expect(mockFetch).toHaveBeenLastCalledWith('/resources/res-1/download', {
        headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
      });
      expect(download).toBe(blob);
    });

    it('rejects fetchResourceDownloadUrl when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.fetchResourceDownloadUrl('res-1')).rejects.toEqual(
        new Error('Inicia sesión para continuar.')
      );
    });

    it('resolves the converted-preview binary response as a Blob with the idToken', async () => {
      const result = await signIn();
      const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' });
      mockFetch.mockResolvedValueOnce({ ...profileResponse(200), blob: () => Promise.resolve(blob) });

      const preview = await result.current.fetchResourcePreviewUrl('res-1');

      expect(mockFetch).toHaveBeenLastCalledWith('/resources/res-1/preview', {
        headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
      });
      expect(preview).toBe(blob);
    });

    it('rejects fetchResourcePreviewUrl when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.fetchResourcePreviewUrl('res-1')).rejects.toEqual(
        new Error('Inicia sesión para continuar.')
      );
    });

    it('deletes a resource with the idToken', async () => {
      const result = await signIn();
      mockFetch.mockResolvedValueOnce(profileResponse(200, { deleted: true }));

      await result.current.deleteResource('res-1');

      expect(mockFetch).toHaveBeenLastCalledWith('/resources/res-1', {
        method: 'DELETE',
        headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
      });
    });

    it('rejects deleteResource when there is no signed-in user', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.deleteResource('res-1')).rejects.toEqual(
        new Error('Inicia sesión para continuar.')
      );
    });
  });

  describe('the teacher notification endpoints', () => {
    async function signInTeacher() {
      mockFetch.mockResolvedValueOnce(profileResponse(200, { ...mockProfile, role: 'teacher' }));
      const { result } = renderHook(() => useFirebaseAuth());
      await act(async () => {
        await mockAuthStateCallback(mockUser);
      });
      return result;
    }

    it('lists a page with an encoded cursor and exposes structured 404 errors', async () => {
      const result = await signInTeacher();
      const page = { items: [], unreadCount: 3, nextCursor: null, hasMore: false };
      mockFetch.mockResolvedValueOnce(profileResponse(200, page));

      await expect(result.current.fetchNotifications('generation/1+older')).resolves.toEqual(page);
      expect(mockFetch).toHaveBeenLastCalledWith('/notifications?cursor=generation%2F1%2Bolder', {
        headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
      });

      mockFetch.mockResolvedValueOnce({
        ...profileResponse(404, { error: { message: 'notifications unavailable' } }),
        statusText: 'Not Found',
      });
      await expect(result.current.fetchNotifications()).rejects.toEqual(
        expect.objectContaining({
          message: 'No se pudo completar la solicitud.',
          status: 404,
          code: 'notifications unavailable',
        })
      );

      mockFetch.mockResolvedValueOnce({
        ...profileResponse(409, { error: { message: 'stale_cursor', explanation: 'Refresh page one.' } }),
        statusText: 'Conflict',
      });
      await expect(result.current.fetchNotifications('retired')).rejects.toEqual(
        expect.objectContaining({ message: 'Refresh page one.', status: 409, code: 'stale_cursor' })
      );
    });

    it('marks one encoded notification read without sending client authority', async () => {
      const result = await signInTeacher();
      const response = { notification: { notificationId: 'item/1', readAtMs: 500 }, unreadCount: 2 };
      mockFetch.mockResolvedValueOnce(profileResponse(200, response));

      await expect(result.current.markNotificationRead('item/1')).resolves.toEqual(response);
      expect(mockFetch).toHaveBeenLastCalledWith('/notifications/item%2F1/read', {
        method: 'PATCH',
        headers: { Authorization: 'idToken', 'Accept-Language': 'es' },
      });
    });

    it('sends stable idempotency keys for mark-all and clear', async () => {
      const result = await signInTeacher();
      mockFetch
        .mockResolvedValueOnce(profileResponse(200, { acceptedAtMs: 700, unreadCount: 0 }))
        .mockResolvedValueOnce(profileResponse(200, { acceptedAtMs: 800, unreadCount: 0 }));

      await expect(result.current.markAllNotificationsRead('mark/key')).resolves.toEqual({
        acceptedAtMs: 700,
        unreadCount: 0,
      });
      expect(mockFetch).toHaveBeenLastCalledWith('/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'Idempotency-Key': 'mark/key' },
      });

      await expect(result.current.clearNotifications('clear/key')).resolves.toEqual({
        acceptedAtMs: 800,
        unreadCount: 0,
      });
      expect(mockFetch).toHaveBeenLastCalledWith('/notifications', {
        method: 'DELETE',
        headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'Idempotency-Key': 'clear/key' },
      });
    });

    it('reconciles a trusted scope with report failure episode claims', async () => {
      const result = await signInTeacher();
      const claims = [{ reportId: 'RM123', failureEpisodeId: 'episode_12345678', firstFailedAtMs: 12 }];
      mockFetch.mockResolvedValueOnce(profileResponse(200, { unreadCount: 4, changed: true }));

      await expect(result.current.reconcileNotifications('all', claims)).resolves.toEqual({
        unreadCount: 4,
        changed: true,
      });
      expect(mockFetch).toHaveBeenLastCalledWith('/notifications/reconcile', {
        method: 'POST',
        headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'content-type': 'application/json' },
        body: JSON.stringify({ scope: 'all', pendingReportFailures: claims }),
      });
    });

    it('transports durable recording request and report failure episode identities', async () => {
      const result = await signInTeacher();
      const recording = { status: 'enqueued', manualRequestId: 'manual_12345678' };
      mockFetch.mockResolvedValueOnce(profileResponse(200, { recording })).mockResolvedValueOnce(profileResponse(204));

      await expect(result.current.requestRecordingArtifact('RM123', 'manual_12345678')).resolves.toEqual(recording);
      expect(mockFetch).toHaveBeenLastCalledWith('/reports/RM123/recording', {
        method: 'POST',
        headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'content-type': 'application/json' },
        body: JSON.stringify({ manualRequestId: 'manual_12345678' }),
      });

      const report = { roomSid: 'RM123' } as any;
      await result.current.saveAttentionReport(report, 'episode_12345678');
      expect(mockFetch).toHaveBeenLastCalledWith('/reports', {
        method: 'POST',
        headers: { Authorization: 'idToken', 'Accept-Language': 'es', 'content-type': 'application/json' },
        body: JSON.stringify({ ...report, failureEpisodeId: 'episode_12345678' }),
      });
    });

    it('reuses an auto-generated manual request identity after an ambiguous response', async () => {
      const result = await signInTeacher();
      mockFetch
        .mockResolvedValueOnce({
          ...profileResponse(409, { error: { message: 'recording request ambiguous' } }),
          statusText: 'Conflict',
        })
        .mockResolvedValueOnce(profileResponse(200, { recording: { status: 'processing' } }));

      await expect(result.current.requestRecordingArtifact('RM456')).rejects.toEqual(
        expect.objectContaining({ status: 409, code: 'recording request ambiguous' })
      );
      await expect(result.current.requestRecordingArtifact('RM456')).resolves.toEqual({ status: 'processing' });

      const recordingCalls = mockFetch.mock.calls.filter(([url]) => url === '/reports/RM456/recording');
      expect(recordingCalls).toHaveLength(2);
      expect(JSON.parse(recordingCalls[0][1].body).manualRequestId).toMatch(/^manual_[a-z0-9]+_[a-z0-9]+$/);
      expect(recordingCalls[1][1].body).toBe(recordingCalls[0][1].body);
    });
  });
});
