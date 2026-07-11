import React, { createContext, useContext, useReducer, useState } from 'react';
import { RecordingRules, RoomType } from '../types';
import { TwilioError } from 'twilio-video';
import { settingsReducer, initialSettings, Settings, SettingsAction } from './settings/settingsReducer';
import useActiveSinkId from './useActiveSinkId/useActiveSinkId';
import useFirebaseAuth, { UserProfile, ResourceRecord, ClassRecord } from './useFirebaseAuth/useFirebaseAuth';
import { useLocalStorageState } from '../hooks/useLocalStorageState/useLocalStorageState';
import usePasscodeAuth from './usePasscodeAuth/usePasscodeAuth';
import { User } from 'firebase/auth';
import { ClassSessionRole } from '../components/PreJoinScreens/classSessionTypes';
import { AttentionReport, StoredAttentionReport } from '../components/AttentionProvider/reportTypes';

export interface StateContextType {
  error: TwilioError | Error | null;
  setError(error: TwilioError | Error | null): void;
  getToken(name: string, room: string, passcode?: string): Promise<{ room_type: RoomType; token: string }>;
  user?: User | null | { displayName: undefined; photoURL: undefined; passcode?: string };
  signIn?(passcode?: string): Promise<void>;
  signOut?(): Promise<void>;
  isAuthReady?: boolean;
  // Firebase-mode only (undefined in the other auth modes): the Firestore-backed
  // user profile and the email/registration flows. The profile role is what the
  // prejoin flow uses to preselect teacher/student; the server re-resolves it from
  // Firestore on every request, so it is UX state, not an authorization boundary.
  profile?: UserProfile | null;
  signInWithEmail?(email: string, password: string): Promise<void>;
  register?(name: string, email: string, password: string, role: ClassSessionRole): Promise<void>;
  completeProfile?(role: ClassSessionRole): Promise<void>;
  createPassword?(password: string): Promise<void>;
  updateTeacherProfile?(input: {
    displayName?: string;
    avatarDataUrl?: string | null;
    syncEmail?: true;
  }): Promise<UserProfile>;
  changeEmail?(email: string, currentPassword?: string): Promise<UserProfile>;
  changePassword?(currentPassword: string | undefined, newPassword: string): Promise<void>;
  // Firebase-mode only: persistence of per-class attention reports (teacher-only,
  // enforced server-side). Undefined in the other auth modes, so consumers gate on
  // presence and the feature is silently absent — same contract as /profile.
  saveAttentionReport?(report: AttentionReport): Promise<void>;
  fetchAttentionReports?(): Promise<StoredAttentionReport[]>;
  fetchAttentionReport?(roomSid: string): Promise<StoredAttentionReport>;
  // Firebase-mode only: real persistence for the "Recursos" tab (teacher-uploaded
  // class materials). Undefined in the other auth modes — ResourcesTab gates on
  // presence, same contract as saveAttentionReport/fetchAttentionReports.
  fetchResources?(): Promise<ResourceRecord[]>;
  uploadResource?(file: File, classId: string): Promise<ResourceRecord>;
  fetchResourceDownloadUrl?(id: string): Promise<{ content: string; contentType: string; name: string }>;
  deleteResource?(id: string): Promise<void>;
  // Firebase-mode only: real persistence for the "Clases" tab (scheduled upcoming
  // sessions). Undefined in the other auth modes — ClassesTab's caller gates on
  // presence, same contract as fetchResources/uploadResource/deleteResource.
  fetchClasses?(): Promise<ClassRecord[]>;
  createClass?(input: {
    title: string;
    scheduledAtMs: number;
    studentCount: number;
    idempotencyKey: string;
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

/*
  The 'react-hooks/rules-of-hooks' linting rules prevent React Hooks from being called
  inside of if() statements. This is because hooks must always be called in the same order
  every time a component is rendered. The 'react-hooks/rules-of-hooks' rule is disabled below
  because the "if (process.env.REACT_APP_SET_AUTH === 'firebase')" statements are evaluated
  at build time (not runtime). If the statement evaluates to false, then the code is not
  included in the bundle that is produced (due to tree-shaking). Thus, in this instance, it
  is ok to call hooks inside if() statements.
*/
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

  if (process.env.REACT_APP_SET_AUTH === 'firebase') {
    contextValue = {
      ...contextValue,
      ...useFirebaseAuth(), // eslint-disable-line react-hooks/rules-of-hooks
    };
  } else if (process.env.REACT_APP_SET_AUTH === 'passcode') {
    contextValue = {
      ...contextValue,
      ...usePasscodeAuth(), // eslint-disable-line react-hooks/rules-of-hooks
    };
  } else {
    contextValue = {
      ...contextValue,
      getToken: async (user_identity, room_name) => {
        const endpoint = process.env.REACT_APP_TOKEN_ENDPOINT || '/token';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            user_identity,
            room_name,
            create_conversation: process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS !== 'true',
          }),
        });

        if (!response.ok) {
          // Surface the server's reason (e.g. the room-access guard rejecting a student
          // for a room the teacher hasn't opened) through the app-level ErrorDialog.
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error?.explanation || body.error?.message || response.statusText);
        }

        return response.json();
      },
      updateRecordingRules: async (room_sid, rules) => {
        const endpoint = process.env.REACT_APP_TOKEN_ENDPOINT || '/recordingrules';

        return fetch(endpoint, {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ room_sid, rules }),
          method: 'POST',
        })
          .then(async res => {
            const jsonResponse = await res.json();

            if (!res.ok) {
              const recordingError = new Error(
                jsonResponse.error?.message || 'There was an error updating recording rules'
              );
              recordingError.code = jsonResponse.error?.code;
              return Promise.reject(recordingError);
            }

            return jsonResponse;
          })
          .catch(err => setError(err));
      },
    };
  }

  const getToken: StateContextType['getToken'] = (name, room) => {
    setIsFetching(true);
    return contextValue
      .getToken(name, room)
      .then(res => {
        setRoomType(res.room_type);
        setIsFetching(false);
        return res;
      })
      .catch(err => {
        setError(err);
        setIsFetching(false);
        return Promise.reject(err);
      });
  };

  const updateRecordingRules: StateContextType['updateRecordingRules'] = (room_sid, rules) => {
    setIsFetching(true);
    return contextValue
      .updateRecordingRules(room_sid, rules)
      .then(res => {
        setIsFetching(false);
        return res;
      })
      .catch(err => {
        setError(err);
        setIsFetching(false);
        return Promise.reject(err);
      });
  };

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
