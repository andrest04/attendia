import { useCallback, useEffect, useRef, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  updateEmail,
} from 'firebase/auth';
import { ClassSessionRole } from '../../components/PreJoinScreens/classSessionTypes';
import {
  AttentionReport,
  RecordingArtifact,
  StoredAttentionReport,
} from '../../components/AttentionProvider/reportTypes';
import { ResourceFileKind } from '../../components/TeacherDashboard/types';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
};

function reportProfileFailure(user: User, operation: string, error: any): void {
  const failure = typeof error?.code === 'string' ? error.code : 'unknown';
  user
    .getIdToken()
    .then(idToken =>
      fetch('/operational-events', {
        method: 'POST',
        headers: { Authorization: idToken, 'content-type': 'application/json' },
        body: JSON.stringify({ operation, failure }),
      }).then(response => {
        if (!response.ok) throw new Error(`operational event rejected: ${response.status}`);
      })
    )
    .catch(() => console.error(JSON.stringify({ level: 'error', event: 'operational_failure', operation, failure })));
}

// Mirror of the users/{uid} Firestore document served by GET/POST /profile. The role
// here only drives client UX (prejoin role preselection); the server re-resolves the
// role from Firestore on every request — the browser is never trusted at request time.
export interface UserProfile {
  displayName: string;
  email: string;
  role: ClassSessionRole;
  avatarUrl?: string;
}

// Shared non-OK handling for the /profile and /reports requests: surface the
// server's reason, preferring the localized Spanish explanation. No-op on OK
// responses (the body is left unconsumed for the caller).
async function throwOnErrorResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  const body = await response.json().catch(() => ({}));
  throw new Error(body.error?.explanation || body.error?.message || response.statusText);
}

// GET /profile for the signed-in user. Resolves null on 404, meaning "no profile yet"
// (a first-time Google user who still needs to pick a role). Throws on other failures.
async function fetchProfileRequest(user: User): Promise<UserProfile | null> {
  const idToken = await user.getIdToken();

  const response = await fetch('/profile', {
    headers: { Authorization: idToken },
  });

  if (response.status === 404) {
    return null;
  }

  await throwOnErrorResponse(response);

  return response.json();
}

// POST /profile. The server creates the profile if missing (201) or echoes the existing
// one untouched (200) — role is write-once there. Rejects on any other non-OK response.
async function postProfileRequest(user: User, displayName: string, role: ClassSessionRole): Promise<UserProfile> {
  const idToken = await user.getIdToken();

  const response = await fetch('/profile', {
    method: 'POST',
    headers: { Authorization: idToken, 'content-type': 'application/json' },
    body: JSON.stringify({ displayName, role }),
  });

  await throwOnErrorResponse(response);

  return response.json();
}

async function patchProfileRequest(
  user: User,
  input: { displayName?: string; syncEmail?: true }
): Promise<UserProfile> {
  const idToken = await user.getIdToken(true);
  const response = await fetch('/profile', {
    method: 'PATCH',
    headers: { Authorization: idToken, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  await throwOnErrorResponse(response);
  return response.json();
}

// POST /reports. The server enforces role=teacher (403) and overwrites the doc keyed
// by roomSid. Rejects on any non-OK response, preferring the Spanish explanation.
async function postReportRequest(user: User, report: AttentionReport): Promise<void> {
  const idToken = await user.getIdToken();

  const response = await fetch('/reports', {
    method: 'POST',
    headers: { Authorization: idToken, 'content-type': 'application/json' },
    body: JSON.stringify(report),
  });

  await throwOnErrorResponse(response);
}

// GET /reports — the signed-in teacher's stored class reports, newest first.
async function fetchReportsRequest(user: User): Promise<StoredAttentionReport[]> {
  const idToken = await user.getIdToken();

  const response = await fetch('/reports', {
    headers: { Authorization: idToken },
  });

  await throwOnErrorResponse(response);

  return response.json();
}

async function fetchReportRequest(user: User, roomSid: string): Promise<StoredAttentionReport> {
  const idToken = await user.getIdToken();
  const response = await fetch(`/reports/${encodeURIComponent(roomSid)}`, {
    headers: { Authorization: idToken },
  });
  await throwOnErrorResponse(response);
  return response.json();
}

// POST /reports/:roomSid/recording — requests (or re-fetches, if already requested and
// still in flight/done) a Twilio Composition for a completed, recorded class.
async function requestRecordingArtifactRequest(user: User, roomSid: string): Promise<RecordingArtifact> {
  const idToken = await user.getIdToken();
  const response = await fetch(`/reports/${encodeURIComponent(roomSid)}/recording`, {
    method: 'POST',
    headers: { Authorization: idToken },
  });
  await throwOnErrorResponse(response);
  const body = await response.json();
  return body.recording;
}

// GET /reports/:roomSid/recording — refreshes and persists the composition's status.
async function fetchRecordingArtifactStatusRequest(user: User, roomSid: string): Promise<RecordingArtifact> {
  const idToken = await user.getIdToken();
  const response = await fetch(`/reports/${encodeURIComponent(roomSid)}/recording`, {
    headers: { Authorization: idToken },
  });
  await throwOnErrorResponse(response);
  const body = await response.json();
  return body.recording;
}

// GET /reports/:roomSid/recording/download-url — issues a one-time ticketed URL. The
// download itself is reached with `window.open`, which cannot carry the Authorization
// header, hence the indirection through this ticket-issuing endpoint.
async function fetchRecordingDownloadUrlRequest(user: User, roomSid: string): Promise<string> {
  const idToken = await user.getIdToken();
  const response = await fetch(`/reports/${encodeURIComponent(roomSid)}/recording/download-url`, {
    headers: { Authorization: idToken },
  });
  await throwOnErrorResponse(response);
  const body = await response.json();
  return body.downloadUrl;
}

// Mirror of one users/{uid}/resources/{id} document served by the /resources
// endpoints. Size/date formatting for display is left to the client — this is the
// raw wire shape, same convention as StoredAttentionReport's endedAtMs.
export interface ResourceRecord {
  id: string;
  name: string;
  kind: ResourceFileKind;
  roomLabel: string;
  classId?: string;
  classTitle?: string;
  roomName?: string;
  sizeBytes: number;
  contentType: string;
  createdAtMs: number | null;
}

// GET /resources — the signed-in teacher's uploaded class materials, newest first.
async function fetchResourcesRequest(user: User): Promise<ResourceRecord[]> {
  const idToken = await user.getIdToken();

  const response = await fetch('/resources', {
    headers: { Authorization: idToken },
  });

  await throwOnErrorResponse(response);

  return response.json();
}

// POST /resources (multipart). No content-type header is set — the browser fills
// in the multipart boundary for us when the body is a FormData.
async function uploadResourceRequest(user: User, file: File, classId: string): Promise<ResourceRecord> {
  const idToken = await user.getIdToken();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('classId', classId);

  const response = await fetch('/resources', {
    method: 'POST',
    headers: { Authorization: idToken },
    body: formData,
  });

  await throwOnErrorResponse(response);

  return response.json();
}

// GET /resources/:id/download — streams the authenticated binary response into a Blob.
async function fetchResourceDownloadRequest(user: User, id: string): Promise<Blob> {
  const idToken = await user.getIdToken();

  const response = await fetch(`/resources/${encodeURIComponent(id)}/download`, {
    headers: { Authorization: idToken },
  });

  await throwOnErrorResponse(response);

  return response.blob();
}

// DELETE /resources/:id
async function deleteResourceRequest(user: User, id: string): Promise<void> {
  const idToken = await user.getIdToken();

  const response = await fetch(`/resources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: idToken },
  });

  await throwOnErrorResponse(response);
}

// POST /profile/avatar (multipart). Uploads the compressed avatar to Appwrite Storage
// (via the server) and returns the updated profile with the new avatarUrl.
async function uploadAvatarRequest(user: User, file: File): Promise<UserProfile> {
  const idToken = await user.getIdToken();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/profile/avatar', {
    method: 'POST',
    headers: { Authorization: idToken },
    body: formData,
  });
  await throwOnErrorResponse(response);
  return response.json();
}

// DELETE /profile/avatar
async function deleteAvatarRequest(user: User): Promise<UserProfile> {
  const idToken = await user.getIdToken();
  const response = await fetch('/profile/avatar', {
    method: 'DELETE',
    headers: { Authorization: idToken },
  });
  await throwOnErrorResponse(response);
  return response.json();
}

// Mirror of one users/{uid}/classes/{id} document served by the /classes
// endpoints. roomName is the server-computed slug — the honest real value, no
// separate abbreviation field.
export interface ClassRecord {
  id: string;
  title: string;
  roomName: string;
  scheduledAtMs: number | null;
  studentCount: number;
  status?: 'scheduled' | 'started' | 'completed';
}

// GET /classes — the signed-in teacher's scheduled classes, soonest first.
async function fetchClassesRequest(user: User): Promise<ClassRecord[]> {
  const idToken = await user.getIdToken();

  const response = await fetch('/classes', {
    headers: { Authorization: idToken },
  });

  await throwOnErrorResponse(response);

  return response.json();
}

// POST /classes
async function createClassRequest(
  user: User,
  input: { title: string; scheduledAtMs: number; studentCount: number; idempotencyKey: string }
): Promise<ClassRecord> {
  const idToken = await user.getIdToken();

  const response = await fetch('/classes', {
    method: 'POST',
    headers: { Authorization: idToken, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  await throwOnErrorResponse(response);

  return response.json();
}

// DELETE /classes/:id
async function deleteClassRequest(user: User, id: string): Promise<void> {
  const idToken = await user.getIdToken();

  const response = await fetch(`/classes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: idToken },
  });

  await throwOnErrorResponse(response);
}

async function startClassRequest(user: User, id: string, roomName: string): Promise<void> {
  const idToken = await user.getIdToken();
  const response = await fetch(`/classes/${encodeURIComponent(id)}/start`, {
    method: 'POST',
    headers: { Authorization: idToken, 'content-type': 'application/json' },
    body: JSON.stringify({ roomName }),
  });
  await throwOnErrorResponse(response);
}

export default function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Monotonic id guarding profile updates: a slow GET /profile must never clobber the
  // profile a later register()/completeProfile() POST just established.
  const profileRequestIdRef = useRef(0);

  const applyProfile = useCallback((newProfile: UserProfile | null) => {
    profileRequestIdRef.current++;
    setProfile(newProfile);
  }, []);

  const refreshProfile = useCallback(async (currentUser: User) => {
    const requestId = ++profileRequestIdRef.current;

    // A profile-fetch failure must not block an otherwise successful sign-in: the user
    // just lands on the role-completion step, and completing it repairs the state.
    const fetchedProfile = await fetchProfileRequest(currentUser).catch(err => {
      console.error('Error fetching the user profile:', err);
      return null;
    });

    if (requestId === profileRequestIdRef.current) {
      setProfile(fetchedProfile);
    }
    return fetchedProfile;
  }, []);

  const getToken = useCallback(
    async (user_identity: string, room_name: string) => {
      const headers = new window.Headers();

      const idToken = await user!.getIdToken();
      headers.set('Authorization', idToken);
      headers.set('content-type', 'application/json');

      const endpoint = process.env.REACT_APP_TOKEN_ENDPOINT || '/token';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_identity,
          room_name,
          create_conversation: process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS !== 'true',
        }),
      });

      if (!response.ok) {
        // Surface the server's reason (e.g. the room-access guard rejecting a student
        // for a room the teacher hasn't opened) instead of resolving with no token.
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error?.explanation || body.error?.message || response.statusText);
      }

      return response.json();
    },
    [user]
  );

  const updateRecordingRules = useCallback(
    async (room_sid, rules) => {
      const headers = new window.Headers();

      const idToken = await user!.getIdToken();
      headers.set('Authorization', idToken);
      headers.set('content-type', 'application/json');

      return fetch('/recordingrules', {
        method: 'POST',
        headers,
        body: JSON.stringify({ room_sid, rules }),
      }).then(async res => {
        const jsonResponse = await res.json();

        if (!res.ok) {
          const recordingError = new Error(
            jsonResponse.error?.message || 'There was an error updating recording rules'
          );
          recordingError.code = jsonResponse.error?.code;
          return Promise.reject(recordingError);
        }

        return jsonResponse;
      });
    },
    [user]
  );

  // The auth-state listener only settles the INITIAL state (page load) and reacts to
  // external sign-outs. Interactive flows (signIn/signInWithEmail/register/signOut)
  // own their own user+profile transitions; letting the listener also react to their
  // intermediate auth events would expose `user` before the profile settles and flash
  // the wrong view (e.g. the role-completion step mid-registration).
  const hasHandledInitialAuthRef = useRef(false);

  useEffect(() => {
    initializeApp(firebaseConfig);
    getAuth().onAuthStateChanged(async newUser => {
      if (!hasHandledInitialAuthRef.current) {
        hasHandledInitialAuthRef.current = true;
        if (newUser) {
          // Resolve the profile BEFORE exposing the user, so consumers (PrivateRoute,
          // PreJoinScreens) never observe an authenticated user with an unsettled
          // profile on page load — the app must not flash wrong routes or roles.
          await refreshProfile(newUser);
        }
        setUser(newUser);
        setIsAuthReady(true);
        return;
      }

      if (!newUser) {
        applyProfile(null);
        setUser(null);
      }
    });
  }, [refreshProfile, applyProfile]);

  const signIn = useCallback(() => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/plus.login');

    return signInWithPopup(getAuth(), provider).then(async newUser => {
      // Profile first, user second — see the auth-state listener note above.
      await refreshProfile(newUser.user);
      setUser(newUser.user);
    });
  }, [refreshProfile]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const credential = await signInWithEmailAndPassword(getAuth(), email, password);
      await refreshProfile(credential.user);
      setUser(credential.user);
    },
    [refreshProfile]
  );

  const register = useCallback(
    async (name: string, email: string, password: string, role: ClassSessionRole) => {
      const credential = await createUserWithEmailAndPassword(getAuth(), email, password);
      await updateProfile(credential.user, { displayName: name });

      try {
        const createdProfile = await postProfileRequest(credential.user, name, role);
        applyProfile(createdProfile);
      } finally {
        // Expose the user even if the profile write failed: the Firebase account
        // exists either way, and the role-completion step can retry the write.
        setUser(credential.user);
      }
    },
    [applyProfile]
  );

  // Completes a first-time Google sign-in: the user is authenticated but has no
  // profile yet (GET /profile returned 404), so only the role is missing.
  const completeProfile = useCallback(
    async (role: ClassSessionRole) => {
      if (!user) {
        throw new Error('Cannot complete a profile without an authenticated user');
      }

      const displayName = user.displayName || user.email || '';
      const createdProfile = await postProfileRequest(user, displayName, role);
      applyProfile(createdProfile);
    },
    [user, applyProfile]
  );

  // Links an email/password credential to the current (Google-only) account, so the
  // user can afterwards sign in with either provider — same uid, same Firestore profile.
  const createPassword = useCallback(
    async (password: string) => {
      if (!user || !user.email) {
        throw new Error('Cannot create a password without an authenticated user with an email');
      }

      const result = await linkWithCredential(user, EmailAuthProvider.credential(user.email, password));
      // Expose the updated user so consumers observe the new 'password' entry in
      // providerData. The Firestore profile is untouched by the credential link.
      setUser(result.user);
    },
    [user]
  );

  const reauthenticate = useCallback(
    async (currentPassword?: string) => {
      if (!user || !user.email) throw new Error('No hay una sesión activa para confirmar tu identidad.');
      const hasPasswordProvider = user.providerData.some(provider => provider.providerId === 'password');
      if (hasPasswordProvider) {
        if (!currentPassword) throw new Error('Ingresa tu contraseña actual para continuar.');
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
        return;
      }
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    },
    [user]
  );

  const updateTeacherProfile = useCallback(
    async (input: { displayName?: string; syncEmail?: true }) => {
      if (!user) throw new Error('No hay una sesión activa.');
      const previousDisplayName = user.displayName;
      try {
        if (input.displayName !== undefined) await updateProfile(user, { displayName: input.displayName });
      } catch (error) {
        reportProfileFailure(user, 'profile_auth_display_name_update', error);
        throw error;
      }

      let updatedProfile: UserProfile;
      try {
        updatedProfile = await patchProfileRequest(user, input);
      } catch (error) {
        if (input.displayName !== undefined) {
          try {
            await updateProfile(user, { displayName: previousDisplayName || null });
          } catch (rollbackError) {
            reportProfileFailure(user, 'profile_auth_display_name_rollback', rollbackError);
            throw new Error(
              'No pudimos guardar el nombre ni restaurar tu identidad. Reintenta el cambio para reconciliarla.'
            );
          }
        }
        reportProfileFailure(user, 'profile_firestore_update', error);
        throw error;
      }
      applyProfile(updatedProfile);
      setUser(getAuth().currentUser);
      return updatedProfile;
    },
    [user, applyProfile]
  );

  const changeEmail = useCallback(
    async (email: string, currentPassword?: string) => {
      if (!user) throw new Error('No hay una sesión activa.');
      try {
        await reauthenticate(currentPassword);
        await updateEmail(user, email.trim());
        const updatedProfile = await patchProfileRequest(user, { syncEmail: true });
        applyProfile(updatedProfile);
        setUser(getAuth().currentUser);
        return updatedProfile;
      } catch (error) {
        reportProfileFailure(user, 'profile_email_change', error);
        throw error;
      }
    },
    [user, reauthenticate, applyProfile]
  );

  const changePassword = useCallback(
    async (currentPassword: string | undefined, newPassword: string) => {
      if (!user) throw new Error('No hay una sesión activa.');
      const hasPasswordProvider = user.providerData.some(provider => provider.providerId === 'password');
      try {
        await reauthenticate(currentPassword);
        if (hasPasswordProvider) {
          await updatePassword(user, newPassword);
        } else {
          const result = await linkWithCredential(user, EmailAuthProvider.credential(user.email!, newPassword));
          setUser(result.user);
        }
      } catch (error) {
        reportProfileFailure(user, 'profile_password_change', error);
        throw error;
      }
    },
    [user, reauthenticate]
  );

  // Best-effort persistence of a class attention report. Callers own the error
  // policy (the in-room saver swallows failures so leaving is never blocked).
  const saveAttentionReport = useCallback(
    (report: AttentionReport) => {
      if (!user) {
        return Promise.reject(new Error('Cannot save an attention report without an authenticated user'));
      }
      return postReportRequest(user, report);
    },
    [user]
  );

  const fetchAttentionReports = useCallback(() => {
    if (!user) {
      return Promise.reject(new Error('Cannot fetch attention reports without an authenticated user'));
    }
    return fetchReportsRequest(user);
  }, [user]);

  const fetchAttentionReport = useCallback(
    (roomSid: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot fetch an attention report without an authenticated user'));
      }
      return fetchReportRequest(user, roomSid);
    },
    [user]
  );

  const requestRecordingArtifact = useCallback(
    (roomSid: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot request a recording without an authenticated user'));
      }
      return requestRecordingArtifactRequest(user, roomSid);
    },
    [user]
  );

  const fetchRecordingArtifactStatus = useCallback(
    (roomSid: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot fetch a recording status without an authenticated user'));
      }
      return fetchRecordingArtifactStatusRequest(user, roomSid);
    },
    [user]
  );

  const fetchRecordingDownloadUrl = useCallback(
    (roomSid: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot fetch a recording download url without an authenticated user'));
      }
      return fetchRecordingDownloadUrlRequest(user, roomSid);
    },
    [user]
  );

  const fetchResources = useCallback(() => {
    if (!user) {
      return Promise.reject(new Error('Cannot fetch resources without an authenticated user'));
    }
    return fetchResourcesRequest(user);
  }, [user]);

  const uploadResource = useCallback(
    (file: File, classId: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot upload a resource without an authenticated user'));
      }
      return uploadResourceRequest(user, file, classId);
    },
    [user]
  );

  const fetchResourceDownloadUrl = useCallback(
    (id: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot download a resource without an authenticated user'));
      }
      return fetchResourceDownloadRequest(user, id);
    },
    [user]
  );

  const deleteResource = useCallback(
    (id: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot delete a resource without an authenticated user'));
      }
      return deleteResourceRequest(user, id);
    },
    [user]
  );

  // Unlike uploadResource/deleteResource, avatar changes must update shared profile
  // state immediately (same as updateTeacherProfile), since the profile is what other
  // views (TeacherDashboard header, etc.) read the avatar from.
  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!user) {
        return Promise.reject(new Error('Cannot upload an avatar without an authenticated user'));
      }
      const updatedProfile = await uploadAvatarRequest(user, file);
      applyProfile(updatedProfile);
      return updatedProfile;
    },
    [user, applyProfile]
  );

  const deleteAvatar = useCallback(async () => {
    if (!user) {
      return Promise.reject(new Error('Cannot delete an avatar without an authenticated user'));
    }
    const updatedProfile = await deleteAvatarRequest(user);
    applyProfile(updatedProfile);
    return updatedProfile;
  }, [user, applyProfile]);

  const fetchClasses = useCallback(() => {
    if (!user) {
      return Promise.reject(new Error('Cannot fetch classes without an authenticated user'));
    }
    return fetchClassesRequest(user);
  }, [user]);

  const createClass = useCallback(
    (input: { title: string; scheduledAtMs: number; studentCount: number; idempotencyKey: string }) => {
      if (!user) {
        return Promise.reject(new Error('Cannot create a class without an authenticated user'));
      }
      return createClassRequest(user, input);
    },
    [user]
  );

  const deleteClass = useCallback(
    (id: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot delete a class without an authenticated user'));
      }
      return deleteClassRequest(user, id);
    },
    [user]
  );

  const startClass = useCallback(
    (id: string, roomName: string) => {
      if (!user) return Promise.reject(new Error('Cannot start a class without an authenticated user'));
      return startClassRequest(user, id, roomName);
    },
    [user]
  );

  const signOut = useCallback(() => {
    return getAuth()
      .signOut()
      .then(() => {
        setUser(null);
        applyProfile(null);
      });
  }, [applyProfile]);

  return {
    user,
    profile,
    signIn,
    signInWithEmail,
    register,
    completeProfile,
    createPassword,
    updateTeacherProfile,
    changeEmail,
    changePassword,
    signOut,
    isAuthReady,
    getToken,
    updateRecordingRules,
    saveAttentionReport,
    fetchAttentionReports,
    fetchAttentionReport,
    requestRecordingArtifact,
    fetchRecordingArtifactStatus,
    fetchRecordingDownloadUrl,
    fetchResources,
    uploadResource,
    fetchResourceDownloadUrl,
    deleteResource,
    uploadAvatar,
    deleteAvatar,
    fetchClasses,
    createClass,
    deleteClass,
    startClass,
  };
}
