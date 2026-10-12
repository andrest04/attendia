import React, { createContext, useContext, useReducer, useState } from 'react';
import { RecordingRules, RoomType } from '../types';
import { TwilioError } from 'twilio-video';
import { settingsReducer, initialSettings, Settings, SettingsAction } from './settings/settingsReducer';
import useActiveSinkId from './useActiveSinkId/useActiveSinkId';
import useFirebaseAuth, {
  UserProfile,
  ResourceRecord,
  ClassRecord,
  NotificationPage,
  NotificationReadResult,
  NotificationMutationResult,
  NotificationReconcileResult,
  ReportFailureClaim,
} from './useFirebaseAuth/useFirebaseAuth';
import { useLocalStorageState } from '../hooks/useLocalStorageState/useLocalStorageState';
import { User } from 'firebase/auth';
import { ClassSessionRole } from '../components/PreJoinScreens/classSessionTypes';
import { AttentionReport, RecordingArtifact, StoredAttentionReport } from '../components/AttentionProvider/reportTypes';

export interface StateContextType {
  error: TwilioError | Error | null;
  setError(error: TwilioError | Error | null): void;
  getToken(name: string, room: string): Promise<{ room_type: RoomType; token: string }>;
  user?: User | null;
  signIn?(): Promise<void>;
  signOut?(): Promise<void>;
  isAuthReady?: boolean;
  // The Firestore-backed user profile and the email/registration flows. The profile
  // role is what the prejoin flow uses to preselect teacher/student; the server
  // re-resolves it from Firestore on every request, so it is UX state, not an
  // authorization boundary.
  profile?: UserProfile | null;
  signInWithEmail?(email: string, password: string): Promise<void>;
  register?(name: string, email: string, password: string, role: ClassSessionRole): Promise<void>;
  completeProfile?(role: ClassSessionRole): Promise<void>;
  createPassword?(password: string): Promise<void>;
  updateTeacherProfile?(input: { displayName?: string; syncEmail?: true }): Promise<UserProfile>;
  // Real persistence for the teacher profile avatar (Appwrite Storage, behind the
  // FileStorage port on the server — see server/fileStorage.ts).
  uploadAvatar?(file: File): Promise<UserProfile>;
  deleteAvatar?(): Promise<UserProfile>;
  restoreProviderPhoto?(): Promise<UserProfile>;
  changeEmail?(email: string, currentPassword?: string): Promise<UserProfile>;
  changePassword?(currentPassword: string | undefined, newPassword: string): Promise<void>;
  // Persistence of per-class attention reports (teacher-only, enforced server-side).
  saveAttentionReport?(report: AttentionReport, failureEpisodeId?: string): Promise<void>;
  fetchAttentionReports?(): Promise<StoredAttentionReport[]>;
  fetchAttentionReport?(roomSid: string): Promise<StoredAttentionReport>;
  // Teacher-requested Twilio recording (Composition) artifacts, server-proxied end to
  // end so the Twilio Account SID/Auth Token never reach the browser (see
  // server/recordings.ts).
  requestRecordingArtifact?(roomSid: string, manualRequestId?: string): Promise<RecordingArtifact>;
  fetchRecordingArtifactStatus?(roomSid: string): Promise<RecordingArtifact>;
  fetchRecordingDownloadUrl?(roomSid: string): Promise<string>;
  fetchNotifications?(cursor?: string): Promise<NotificationPage>;
  markNotificationRead?(id: string): Promise<NotificationReadResult>;
  markAllNotificationsRead?(idempotencyKey: string): Promise<NotificationMutationResult>;
  clearNotifications?(idempotencyKey: string): Promise<NotificationMutationResult>;
  reconcileNotifications?(
    scope: 'all' | 'recordings',
    pendingReportFailures?: ReportFailureClaim[]
  ): Promise<NotificationReconcileResult>;
  // Real persistence for the "Recursos" tab (teacher-uploaded class materials).
  fetchResources?(): Promise<ResourceRecord[]>;
  uploadResource?(file: File, classId: string, onProgress?: (percent: number) => void): Promise<ResourceRecord>;
  fetchResourceDownloadUrl?(id: string): Promise<Blob>;
  // A LibreOffice-converted PDF rendition of a presentation/Word resource, for
  // in-browser viewing (see server/resources.ts createPreviewResourceHandler). The
  // original bytes served by fetchResourceDownloadUrl are never touched.
  fetchResourcePreviewUrl?(id: string): Promise<Blob>;
  deleteResource?(id: string): Promise<void>;
  // Real persistence for the "Clases" tab (scheduled upcoming sessions).
  fetchClasses?(): Promise<ClassRecord[]>;
  createClass?(input: {
    title: string;
    scheduledAtMs: number;
    studentCount: number;
    durationMinutes: number;
    idempotencyKey: string;
    roomName?: string;
  }): Promise<ClassRecord>;
  deleteClass?(id: string): Promise<void>;
  startClass?(id: string, roomName: string): Promise<void>;
  isFetching: boolean;
  activeSinkId: string;
  setActiveSinkId(sinkId: string): void;
  settings: Settings;
  dispatchSetting: React.Dispatch<SettingsAction>;
  roomType?: RoomType;
  updateRecordingRules(room_sid: string, rules: RecordingRules): Promise<object>;
  isGalleryViewActive: boolean;
  setIsGalleryViewActive: React.Dispatch<React.SetStateAction<boolean>>;
  maxGalleryViewParticipants: number;
  setMaxGalleryViewParticipants: React.Dispatch<React.SetStateAction<number>>;
  isKrispEnabled: boolean;
  setIsKrispEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  isKrispInstalled: boolean;
  setIsKrispInstalled: React.Dispatch<React.SetStateAction<boolean>>;
  isCaptionsEnabled: boolean;
  setIsCaptionsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  // True once the teacher has ended the session for everyone. Lives here (above Room,
  // which unmounts on disconnect) so App can show the "session ended" screen instead of
  // bouncing back to the prejoin lobby. See useSessionEnd + SessionEndedScreen.
  sessionEndedByProfessor: boolean;
  setSessionEndedByProfessor: React.Dispatch<React.SetStateAction<boolean>>;
}

export const StateContext = createContext<StateContextType>(null!);

export default function AppStateProvider(props: React.PropsWithChildren<{}>) {
  const [error, setError] = useState<TwilioError | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isGalleryViewActive, setIsGalleryViewActive] = useLocalStorageState('gallery-view-active-key', true);
  const [activeSinkId, setActiveSinkId] = useActiveSinkId();
  const [settings, dispatchSetting] = useReducer(settingsReducer, initialSettings);
  const [roomType, setRoomType] = useState<RoomType>();
  const [maxGalleryViewParticipants, setMaxGalleryViewParticipants] = useLocalStorageState(
    'max-gallery-participants-key',
    6
  );

  const [isKrispEnabled, setIsKrispEnabled] = useState(false);
  const [isKrispInstalled, setIsKrispInstalled] = useState(false);
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useLocalStorageState('captions-enabled-key', false);
  const [sessionEndedByProfessor, setSessionEndedByProfessor] = useState(false);

  let contextValue = {
    error,
    setError,
    isFetching,
    activeSinkId,
    setActiveSinkId,
    settings,
    dispatchSetting,
    roomType,
    isGalleryViewActive,
    setIsGalleryViewActive,
    maxGalleryViewParticipants,
    setMaxGalleryViewParticipants,
    isKrispEnabled,
    setIsKrispEnabled,
    isKrispInstalled,
    setIsKrispInstalled,
    isCaptionsEnabled,
    setIsCaptionsEnabled,
    sessionEndedByProfessor,
    setSessionEndedByProfessor,
  } as StateContextType;

  contextValue = {
    ...contextValue,
    ...useFirebaseAuth(),
  };

  // Decorator for the two operations that talk to the video server: it raises
  // `isFetching` for the duration of the call, runs `onSuccess` with the result, and on
  // failure surfaces the error to the app-level ErrorDialog before re-rejecting so
  // callers can still react to it.
  function withFetching<Args extends any[], Result>(
    operation: (...args: Args) => Promise<Result>,
    onSuccess?: (result: Result) => void
  ): (...args: Args) => Promise<Result> {
    return (...args: Args) => {
      setIsFetching(true);
      return operation(...args)
        .then(result => {
          if (onSuccess) onSuccess(result);
          setIsFetching(false);
          return result;
        })
        .catch(err => {
          setError(err);
          setIsFetching(false);
          return Promise.reject(err);
        });
    };
  }

  const getToken: StateContextType['getToken'] = withFetching(
    (name, room) => contextValue.getToken(name, room),
    res => setRoomType(res.room_type)
  );

  const updateRecordingRules: StateContextType['updateRecordingRules'] = withFetching((room_sid, rules) =>
    contextValue.updateRecordingRules(room_sid, rules)
  );

  return (
    <StateContext.Provider value={{ ...contextValue, getToken, updateRecordingRules }}>
      {props.children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within the AppStateProvider');
  }
  return context;
}
