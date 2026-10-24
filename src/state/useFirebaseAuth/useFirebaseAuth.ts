import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ClassSessionRole } from '../../classSession/classSessionTypes';
import {
  AttentionReport,
  RecordingArtifact,
  StoredAttentionReport,
} from '../../components/AttentionProvider/reportTypes';
import { ResourceFileKind } from '../../components/TeacherDashboard/types';
import { ClientApiError, createApiClient, throwOnErrorResponse, withUser } from './apiClient';
import { acceptLanguageHeader } from '../../i18n/locale';
import { featureFlags } from '../../utils/featureFlags';
import { t } from '../../i18n/translate';

// Re-exported so existing importers keep working; the class lives with the API client.
export { ClientApiError };

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
};

function reportProfileFailure(user: User, operation: string, error: any): void {
  const failure = typeof error?.code === 'string' ? error.code : 'unknown';
  createApiClient(user)
    .send('/operational-events', { method: 'POST', json: { operation, failure } })
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
  // True once the user explicitly removed their photo — see server/userProfiles.ts.
  avatarRemoved?: boolean;
}

export type NotificationEventType =
  | 'class.upcoming'
  | 'class.not_started'
  | 'recording.ready'
  | 'recording.failed'
  | 'report.save_failed';

export interface TeacherNotification {
  notificationId: string;
  ownerUid: string;
  eventType: NotificationEventType;
  eventKey: string;
  source:
    | { kind: 'class'; classId: string }
    | { kind: 'recording'; roomSid: string; manualRequestId: string }
    | { kind: 'report'; reportId: string; failureEpisodeId: string };
  eventOccurrenceAtMs: number | null;
  createdAtMs: number | null;
  readAtMs: number | null;
  title: string;
  message: string;
  destination:
    | { kind: 'classes' }
    | { kind: 'recording'; roomSid: string }
    | { kind: 'report-retry'; reportId: string };
}

export interface NotificationPage {
  items: TeacherNotification[];
  unreadCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ReportFailureClaim {
  reportId: string;
  failureEpisodeId: string;
  firstFailedAtMs: number;
}

export interface NotificationMutationResult {
  acceptedAtMs: number;
  unreadCount: number;
}
export interface NotificationReadResult {
  notification: TeacherNotification;
  unreadCount: number;
}
export interface NotificationReconcileResult {
  unreadCount: number;
  changed: boolean;
}

// GET /profile for the signed-in user. Resolves null on 404, meaning "no profile yet"
// (a first-time Google user who still needs to pick a role). Throws on other failures.
async function fetchProfileRequest(user: User): Promise<UserProfile | null> {
  const response = await createApiClient(user).raw('/profile');

  if (response.status === 404) {
    return null;
  }

  await throwOnErrorResponse(response);

  return response.json();
}

// POST /profile. The server creates the profile if missing (201) or echoes the existing
// one untouched (200) — role is write-once there. Rejects on any other non-OK response.
const postProfileRequest = (user: User, displayName: string, role: ClassSessionRole): Promise<UserProfile> =>
  createApiClient(user).json('/profile', { method: 'POST', json: { displayName, role } });

const patchProfileRequest = (
  user: User,
  input: { displayName?: string; syncEmail?: true; restorePhoto?: true }
): Promise<UserProfile> => createApiClient(user).json('/profile', { method: 'PATCH', json: input, forceRefresh: true });

// POST /reports. The server enforces role=teacher (403) and overwrites the doc keyed
// by roomSid. Rejects on any non-OK response, preferring the Spanish explanation.
const postReportRequest = (user: User, report: AttentionReport, failureEpisodeId?: string): Promise<void> =>
  createApiClient(user).send('/reports', {
    method: 'POST',
    json: failureEpisodeId ? { ...report, failureEpisodeId } : report,
  });

// GET /reports — the signed-in teacher's stored class reports, newest first.
const fetchReportsRequest = (user: User): Promise<StoredAttentionReport[]> => createApiClient(user).json('/reports');

const fetchReportRequest = (user: User, roomSid: string): Promise<StoredAttentionReport> =>
  createApiClient(user).json(`/reports/${encodeURIComponent(roomSid)}`);

// POST /reports/:roomSid/recording — requests (or re-fetches, if already requested and
// still in flight/done) a Twilio Composition for a completed, recorded class.
const requestRecordingArtifactRequest = async (
  user: User,
  roomSid: string,
  manualRequestId: string
): Promise<RecordingArtifact> =>
  (
    await createApiClient(user).json(`/reports/${encodeURIComponent(roomSid)}/recording`, {
      method: 'POST',
      json: { manualRequestId },
    })
  ).recording;

const fetchNotificationsRequest = (user: User, cursor?: string): Promise<NotificationPage> =>
  createApiClient(user).json(`/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);

const markNotificationReadRequest = (user: User, id: string): Promise<NotificationReadResult> =>
  createApiClient(user).json(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });

const notificationOperationRequest = (
  user: User,
  path: string,
  method: 'POST' | 'DELETE',
  idempotencyKey: string
): Promise<NotificationMutationResult> =>
  createApiClient(user).json(path, { method, headers: { 'Idempotency-Key': idempotencyKey } });

const reconcileNotificationsRequest = (
  user: User,
  scope: 'all' | 'recordings',
  pendingReportFailures: ReportFailureClaim[] = []
): Promise<NotificationReconcileResult> =>
  createApiClient(user).json('/notifications/reconcile', { method: 'POST', json: { scope, pendingReportFailures } });

// GET /reports/:roomSid/recording — refreshes and persists the composition's status.
const fetchRecordingArtifactStatusRequest = async (user: User, roomSid: string): Promise<RecordingArtifact> =>
  (await createApiClient(user).json(`/reports/${encodeURIComponent(roomSid)}/recording`)).recording;

// GET /reports/:roomSid/recording/download-url — issues a one-time ticketed URL. The
// download itself is reached with `window.open`, which cannot carry the Authorization
// header, hence the indirection through this ticket-issuing endpoint.
const fetchRecordingDownloadUrlRequest = async (user: User, roomSid: string): Promise<string> =>
  (await createApiClient(user).json(`/reports/${encodeURIComponent(roomSid)}/recording/download-url`)).downloadUrl;

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
const fetchResourcesRequest = (user: User): Promise<ResourceRecord[]> => createApiClient(user).json('/resources');

// POST /resources (multipart), via XMLHttpRequest instead of fetch so upload
// progress (xhr.upload.onprogress) is observable — fetch has no cross-browser
// way to report upload (as opposed to download) progress.
async function uploadResourceRequest(
  user: User,
  file: File,
  classId: string,
  onProgress?: (percent: number) => void
): Promise<ResourceRecord> {
  const idToken = await user.getIdToken();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('classId', classId);

  return new Promise<ResourceRecord>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/resources');
    xhr.setRequestHeader('Authorization', idToken);
    const language = acceptLanguageHeader();
    xhr.setRequestHeader('Accept-Language', language['Accept-Language']);

    if (onProgress) {
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      let body: any = {};
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        body = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        reject(new Error(body.error?.explanation || body.error?.message || xhr.statusText));
      }
    };

    xhr.onerror = () => reject(new Error(t('No pudimos subir el archivo. Intenta de nuevo en unos segundos.')));

    xhr.send(formData);
  });
}

// GET /resources/:id/download — streams the authenticated binary response into a Blob.
const fetchResourceDownloadRequest = (user: User, id: string): Promise<Blob> =>
  createApiClient(user).blob(`/resources/${encodeURIComponent(id)}/download`);

// GET /resources/:id/preview — a LibreOffice-converted PDF rendition of a
// presentation/Word resource, for in-browser viewing. The original bytes served by
// fetchResourceDownloadRequest are never touched.
const fetchResourcePreviewRequest = (user: User, id: string): Promise<Blob> =>
  createApiClient(user).blob(`/resources/${encodeURIComponent(id)}/preview`);

// DELETE /resources/:id
const deleteResourceRequest = (user: User, id: string): Promise<void> =>
  createApiClient(user).send(`/resources/${encodeURIComponent(id)}`, { method: 'DELETE' });

// POST /profile/avatar (multipart). Uploads the compressed avatar to Appwrite Storage
// (via the server) and returns the updated profile with the new avatarUrl.
const uploadAvatarRequest = (user: User, file: File): Promise<UserProfile> => {
  const formData = new FormData();
  formData.append('file', file);
  return createApiClient(user).json('/profile/avatar', { method: 'POST', body: formData });
};

// DELETE /profile/avatar
const deleteAvatarRequest = (user: User): Promise<UserProfile> =>
  createApiClient(user).json('/profile/avatar', { method: 'DELETE' });

// Mirror of one users/{uid}/classes/{id} document served by the /classes
// endpoints. roomName is the server-computed slug — the honest real value, no
// separate abbreviation field.
export interface ClassRecord {
  id: string;
  title: string;
  roomName: string;
  scheduledAtMs: number | null;
  studentCount: number;
  durationMinutes: number;
  status?: 'scheduled' | 'started' | 'completed';
}

export interface CreateClassInput {
  title: string;
  scheduledAtMs: number;
  studentCount: number;
  durationMinutes: number;
  idempotencyKey: string;
  roomName?: string;
}

// GET /classes — the signed-in teacher's scheduled classes, soonest first.
const fetchClassesRequest = (user: User): Promise<ClassRecord[]> => createApiClient(user).json('/classes');

// POST /classes
const createClassRequest = (user: User, input: CreateClassInput): Promise<ClassRecord> =>
  createApiClient(user).json('/classes', { method: 'POST', json: input });

// DELETE /classes/:id
const deleteClassRequest = (user: User, id: string): Promise<void> =>
  createApiClient(user).send(`/classes/${encodeURIComponent(id)}`, { method: 'DELETE' });

const startClassRequest = (user: User, id: string, roomName: string): Promise<void> =>
  createApiClient(user).send(`/classes/${encodeURIComponent(id)}/start`, { method: 'POST', json: { roomName } });

export default function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Monotonic id guarding profile updates: a slow GET /profile must never clobber the
  // profile a later register()/completeProfile() POST just established.
  const profileRequestIdRef = useRef(0);
  const manualRequestIdsRef = useRef<{ [roomSid: string]: string }>({});

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
    (user_identity: string, room_name: string) =>
      createApiClient(user!).json(process.env.REACT_APP_TOKEN_ENDPOINT || '/token', {
        method: 'POST',
        json: {
          user_identity,
          room_name,
          create_conversation: !featureFlags.isConversationsDisabled(),
        },
      }),
    [user]
  );

  const updateRecordingRules = useCallback(
    (room_sid, rules) => createApiClient(user!).json('/recordingrules', { method: 'POST', json: { room_sid, rules } }),
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
      if (!user || !user.email) throw new Error(t('No hay una sesión activa para confirmar tu identidad.'));
      const hasPasswordProvider = user.providerData.some(provider => provider.providerId === 'password');
      if (hasPasswordProvider) {
        if (!currentPassword) throw new Error(t('Ingresa tu contraseña actual para continuar.'));
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
        return;
      }
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    },
    [user]
  );

  const updateTeacherProfile = useCallback(
    async (input: { displayName?: string; syncEmail?: true }) => {
      if (!user) throw new Error(t('No hay una sesión activa.'));
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
              t('No pudimos guardar el nombre ni restaurar tu identidad. Reintenta el cambio para reconciliarla.')
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
      if (!user) throw new Error(t('No hay una sesión activa.'));
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
      if (!user) throw new Error(t('No hay una sesión activa.'));
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

  // Every endpoint callback below is the same request bound to the signed-in user:
  // with no user it rejects up front instead of touching the network (see withUser).

  // Best-effort persistence of a class attention report. Callers own the error
  // policy (the in-room saver swallows failures so leaving is never blocked).
  const saveAttentionReport = useMemo(
    () => withUser(user, 'Cannot save an attention report without an authenticated user', postReportRequest),
    [user]
  );

  const fetchAttentionReports = useMemo(
    () => withUser(user, 'Cannot fetch attention reports without an authenticated user', fetchReportsRequest),
    [user]
  );

  const fetchAttentionReport = useMemo(
    () => withUser(user, 'Cannot fetch an attention report without an authenticated user', fetchReportRequest),
    [user]
  );

  const requestRecordingArtifact = useCallback(
    (roomSid: string, suppliedManualRequestId?: string) => {
      if (!user) {
        return Promise.reject(new Error('Cannot request a recording without an authenticated user'));
      }
      const manualRequestId =
        suppliedManualRequestId ||
        manualRequestIdsRef.current[roomSid] ||
        `manual_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 12)}`;
      manualRequestIdsRef.current[roomSid] = manualRequestId;
      return requestRecordingArtifactRequest(user, roomSid, manualRequestId).then(recording => {
        if (recording.status === 'completed' || recording.status === 'failed' || recording.status === 'expired') {
          delete manualRequestIdsRef.current[roomSid];
        }
        return recording;
      });
    },
    [user]
  );

  const fetchNotifications = useMemo(
    () => withUser(user, 'Cannot fetch notifications without an authenticated user', fetchNotificationsRequest),
    [user]
  );

  const markNotificationRead = useMemo(
    () => withUser(user, 'Cannot read a notification without an authenticated user', markNotificationReadRequest),
    [user]
  );

  const markAllNotificationsRead = useMemo(
    () =>
      withUser(user, 'Cannot read notifications without an authenticated user', (u: User, idempotencyKey: string) =>
        notificationOperationRequest(u, '/notifications/mark-all-read', 'POST', idempotencyKey)
      ),
    [user]
  );

  const clearNotifications = useMemo(
    () =>
      withUser(user, 'Cannot clear notifications without an authenticated user', (u: User, idempotencyKey: string) =>
        notificationOperationRequest(u, '/notifications', 'DELETE', idempotencyKey)
      ),
    [user]
  );

  const reconcileNotifications = useMemo(
    () =>
      withUser(
        user,
        'Cannot reconcile notifications without an authenticated user',
        (u: User, scope: 'all' | 'recordings', claims: ReportFailureClaim[] = []) =>
          reconcileNotificationsRequest(u, scope, claims)
      ),
    [user]
  );

  const fetchRecordingArtifactStatus = useMemo(
    () =>
      withUser(
        user,
        'Cannot fetch a recording status without an authenticated user',
        fetchRecordingArtifactStatusRequest
      ),
    [user]
  );

  const fetchRecordingDownloadUrl = useMemo(
    () =>
      withUser(
        user,
        'Cannot fetch a recording download url without an authenticated user',
        fetchRecordingDownloadUrlRequest
      ),
    [user]
  );

  const fetchResources = useMemo(
    () => withUser(user, 'Cannot fetch resources without an authenticated user', fetchResourcesRequest),
    [user]
  );

  const uploadResource = useMemo(
    () => withUser(user, 'Cannot upload a resource without an authenticated user', uploadResourceRequest),
    [user]
  );

  const fetchResourceDownloadUrl = useMemo(
    () => withUser(user, 'Cannot download a resource without an authenticated user', fetchResourceDownloadRequest),
    [user]
  );

  const fetchResourcePreviewUrl = useMemo(
    () => withUser(user, 'Cannot preview a resource without an authenticated user', fetchResourcePreviewRequest),
    [user]
  );

  const deleteResource = useMemo(
    () => withUser(user, 'Cannot delete a resource without an authenticated user', deleteResourceRequest),
    [user]
  );

  // Unlike uploadResource/deleteResource, avatar changes must update shared profile
  // state immediately (same as updateTeacherProfile), since the profile is what other
  // views (TeacherDashboard header, etc.) read the avatar from.
  const uploadAvatar = useMemo(
    () =>
      withUser(user, 'Cannot upload an avatar without an authenticated user', async (u: User, file: File) => {
        const updatedProfile = await uploadAvatarRequest(u, file);
        applyProfile(updatedProfile);
        return updatedProfile;
      }),
    [user, applyProfile]
  );

  const deleteAvatar = useMemo(
    () =>
      withUser(user, 'Cannot delete an avatar without an authenticated user', async (u: User) => {
        const updatedProfile = await deleteAvatarRequest(u);
        applyProfile(updatedProfile);
        return updatedProfile;
      }),
    [user, applyProfile]
  );

  // Clears avatarRemoved so the client resumes falling back to the auth provider's
  // photo (e.g. Google) — the counterpart to deleteAvatar's opt-out.
  const restoreProviderPhoto = useMemo(
    () =>
      withUser(user, 'Cannot restore a photo without an authenticated user', async (u: User) => {
        const updatedProfile = await patchProfileRequest(u, { restorePhoto: true });
        applyProfile(updatedProfile);
        return updatedProfile;
      }),
    [user, applyProfile]
  );

  const fetchClasses = useMemo(
    () => withUser(user, 'Cannot fetch classes without an authenticated user', fetchClassesRequest),
    [user]
  );

  const createClass = useMemo(
    () => withUser(user, 'Cannot create a class without an authenticated user', createClassRequest),
    [user]
  );

  const deleteClass = useMemo(
    () => withUser(user, 'Cannot delete a class without an authenticated user', deleteClassRequest),
    [user]
  );

  const startClass = useMemo(
    () => withUser(user, 'Cannot start a class without an authenticated user', startClassRequest),
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
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    reconcileNotifications,
    fetchRecordingDownloadUrl,
    fetchResources,
    uploadResource,
    fetchResourceDownloadUrl,
    fetchResourcePreviewUrl,
    deleteResource,
    uploadAvatar,
    deleteAvatar,
    restoreProviderPhoto,
    fetchClasses,
    createClass,
    deleteClass,
    startClass,
  };
}
