import React, { useState } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import RoomNameScreen from '../PreJoinScreens/RoomNameScreen/RoomNameScreen';
import { createCollisionSafeClassSessionAccess } from '../../classSession/createCollisionSafeClassSessionAccess';
import {
  ClassSessionAccess,
  ClassSessionDraft,
  createDefaultClassSessionDraft,
  toClassSessionDisplayName,
} from '../../classSession/classSessionTypes';

// Mirrors IntroContainer's contentColumn/contentCard/backToDashboardLink pixel-for-pixel:
// this is the exact same card chrome the standalone prejoin route renders around
// RoomNameScreen — only the page-level hero/header/footer/background circles are dropped,
// since those belong to the standalone route, not the dashboard content pane.
const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    padding: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  contentColumn: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: 520,
    gap: 10,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    width: '100%',
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    [theme.breakpoints.down('sm')]: {
      borderRadius: 12,
    },
  },
}));

/**
 * Embedded in TeacherDashboard's content pane (sidebar/navbar stay visible, so leaving
 * this panel is just clicking another sidebar tab — no back link of its own) when the
 * sidebar's "Iniciar clase" is clicked. Reuses the exact same teacher card — same
 * component, same styling — that PreJoinScreens shows on its standalone room-name step,
 * so the format is identical to the rest of the "Crear sesión" flow. Only once a room is
 * confirmed ("Continuar a verificación") does the app navigate away, straight to the
 * device-selection prejoin step (see App.tsx/onStartClass) — that step stays its own page.
 */
interface Props {
  professorName: string;
  onCreate: (session: { roomName: string; name: string; title: string }) => void;
}

export default function QuickStartClassPanel({ professorName, onCreate }: Props) {
  const classes = useStyles();
  const [name, setName] = useState(professorName);
  const [classSessionDraft, setClassSessionDraft] = useState<ClassSessionDraft>(() => ({
    ...createDefaultClassSessionDraft(professorName),
    role: 'teacher',
  }));
  const [classSessionAccess, setClassSessionAccess] = useState<ClassSessionAccess | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    setClassSessionDraft(draft => ({ ...draft, displayName: value }));
  };

  const handleCreateClassSession = async () => {
    setIsCreatingRoom(true);
    const access = await createCollisionSafeClassSessionAccess(
      classSessionDraft,
      window.location.origin,
      window.location.search || ''
    );
    setIsCreatingRoom(false);
    setClassSessionAccess(access);
  };

  const handleContinueToDeviceSelection = () => {
    if (!classSessionAccess) return;
    onCreate({
      roomName: classSessionAccess.roomName,
      name: toClassSessionDisplayName(classSessionDraft.displayName, 'teacher'),
      title: classSessionDraft.sessionName.trim(),
    });
  };

  return (
    <div className={classes.root} data-testid="dashboard-quick-start-panel">
      <div className={classes.contentColumn}>
        <div className={classes.contentCard}>
          <RoomNameScreen
            name={name}
            roomName={classSessionAccess?.roomName || ''}
            teacherDisplayName={toClassSessionDisplayName(classSessionDraft.displayName, 'teacher')}
            classSessionDraft={classSessionDraft}
            classSessionAccess={classSessionAccess}
            studentJoinCode=""
            isCreatingRoom={isCreatingRoom}
            setName={handleNameChange}
            setStudentJoinCode={() => {}}
            setClassSessionDraft={setClassSessionDraft}
            onSelectRole={() => {}}
            onCreateClassSession={handleCreateClassSession}
            onContinueToDeviceSelection={handleContinueToDeviceSelection}
          />
        </div>
      </div>
    </div>
  );
}
