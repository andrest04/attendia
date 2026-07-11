import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import { useSnackbar } from 'notistack';
import { useAttention } from '../../AttentionProvider';
import { stripTeacherSuffix } from '../../PreJoinScreens/classSessionTypes';
import { ProctoringAlert } from '../../AttentionProvider/types';
import { ShellNotification } from '../StudentRoomShell/useShellNotifications';
import SessionStatusBar from './SessionStatusBar';
import ProfessorLeftRail from './ProfessorLeftRail';
import ProfessorRightRail from './ProfessorRightRail';
import ProctoringAlertModal from './ProctoringAlertModal';
import { ProfessorRightTab } from './professorShellHelpers';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minHeight: 0,
    backgroundColor: '#f0f5ff',
    position: 'relative',
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: '1fr',
    overflow: 'hidden',
    // Smoothly animate the rails opening/closing. The grid always keeps THREE
    // tracks (closed rails collapse to 0px, not removed) so the column widths are
    // interpolable — a changing track count would snap instead of transition.
    transition: 'grid-template-columns 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  // Column templates keyed by which rails are open. Both rails collapse on entry
  // (Meet-style clean stage); the professor opens them from the toolbar, so the
  // video stage owns the full width until then. The down('md') variants narrow the
  // fixed rails on tight desktop widths (960-1280) so the stage stays usable.
  bodyBoth: {
    gridTemplateColumns: '228px 1fr 280px',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '200px 1fr 240px',
    },
  },
  bodyLeftOnly: {
    gridTemplateColumns: '228px 1fr 0px',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '200px 1fr 0px',
    },
  },
  bodyRightOnly: {
    gridTemplateColumns: '0px 1fr 280px',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '0px 1fr 240px',
    },
  },
  bodyNoRails: {
    gridTemplateColumns: '0px 1fr 0px',
  },

  // ── CENTER ──
  center: {
    minWidth: 0,
    display: 'grid',
    gridTemplateRows: '1fr',
    overflow: 'hidden',
    backgroundColor: '#121C2D',
  },
  stageContent: {
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  // Full-width footer spanning the whole shell, so the controls stay centered on
  // screen regardless of which rails are open (Meet-style control bar).
  toolbar: {
    flexShrink: 0,
    backgroundColor: '#0f1e45',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: theme.spacing(1.25, 2),
  },
}));

interface Props {
  stage: React.ReactNode;
  toolbarSlot?: React.ReactNode;
  rightTab?: ProfessorRightTab;
  onRightTabChange?: (tab: ProfessorRightTab) => void;
  /** Content for the chat tab — the embedded ChatWindow, resolved by Room.tsx. */
  rightPanel?: React.ReactNode;
  /** Real room participants (including the professor), in room order. Drives the left-rail roster. */
  participants?: Array<{ identity: string; isLocal?: boolean }>;
  sessionLabel?: string;
  /** Human-facing session/room name shown in the top status bar. */
  sessionName?: string;
  participantCount?: number;
  /** REC indicator state, mirrored from the toolbar toggle (US12). */
  recording?: boolean;
  /** Identities of participants with a raised hand, in queue order. */
  handsRaised?: string[];
  /** Professor action: give the named participant the turn (clears their raised hand). */
  onGrantTurn?: (identity: string) => void;
  /** Professor action: mute the named student's microphone (via the roster kebab menu). */
  onMuteParticipant?: (identity: string) => void;
  /** Professor action: warn the named student about a proctoring condition (from the alert modal). */
  onSendWarning?: (identity: string, kind: ProctoringAlert['kind']) => void;
  /** When true, surface the proctoring alerts feed (US30). Driven by the toolbar toggle. */
  proctoringEnabled?: boolean;
  /** Short, persistent log of students joining/leaving — rendered in the left-rail Notificaciones feed. */
  notifications?: ShellNotification[];
  /** Whether the left (Participantes) rail is open. Collapses on entry, Meet-style. Defaults open for legacy callers/tests. */
  leftOpen?: boolean;
  /** Whether the right (analytics/chat) rail is open. Collapses on entry. Defaults open for legacy callers/tests. */
  rightOpen?: boolean;
  /** Dismiss the left rail from its header × button. */
  onCloseLeft?: () => void;
  /** Dismiss the right rail from its tabs × button. */
  onCloseRight?: () => void;
}

/**
 * Three-rail desktop teacher layout. This component owns the shell scaffolding —
 * the responsive column grid, the shared attention data (via useAttention), and the
 * proctoring/report modal state — and composes the left rail (roster + feeds), the
 * right rail (analytics tabs) and the center stage. The rails and modal are
 * presentational subcomponents; see ProfessorLeftRail / ProfessorRightRail /
 * ProctoringAlertModal and the professorShellHelpers leaf module.
 */
export default function ProfessorRoomShell({
  stage,
  toolbarSlot = null,
  rightTab = 'grupo',
  onRightTabChange,
  rightPanel = null,
  participants = [],
  sessionLabel = 'Sesión Twilio en vivo',
  sessionName = 'Sesión Twilio en vivo',
  participantCount = 0,
  recording = false,
  handsRaised = [],
  onGrantTurn,
  onMuteParticipant,
  onSendWarning,
  proctoringEnabled = false,
  notifications = [],
  leftOpen = true,
  rightOpen = true,
  onCloseLeft,
  onCloseRight,
}: Props) {
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const {
    groupAttention,
    groupDataAvailable,
    attentionThreshold,
    timeline,
    participants: attentionParticipants,
    proctoringAlerts,
    source,
    attentionLevel,
  } = useAttention();
  // Only fire the below-threshold alarm when there is a real reading. With no
  // data, groupAttention is a placeholder 0 — not "0% attention" — so the alarm
  // would be a false alert during a connection drop.
  const isGroupBelowThreshold = groupDataAvailable && groupAttention < attentionThreshold;
  // The "Individual" tab is the analytics surface of the (mocked) attention pipeline,
  // so it stays on attention data; the left-rail roster shows real room presence.
  const sortedParticipants = [...attentionParticipants].sort((a, b) => b.index - a.index);
  // Attention decoration for real participants — identities the pipeline does not know
  // about simply render without a badge (same defensive approach as GalleryView).
  const attentionByIdentity = new Map(attentionParticipants.map(p => [p.identity, p]));
  const studentCount = Math.max(0, participantCount - 1);

  // Reports are available only after their authenticated server-side save. Never
  // copy attention data to browser-global storage just to open another tab.
  const handleOpenReport = () => {
    enqueueSnackbar('El reporte estará disponible en el historial cuando finalice y se guarde la clase.', {
      variant: 'info',
    });
  };

  // Proctoring modal local state
  const [proctoringModalAlert, setProctoringModalAlert] = React.useState<ProctoringAlert | null>(null);
  // Alert ids the professor has resolved (legitimate or warned) — filtered out of the
  // feed so a handled alert disappears. Local to the session; the provider re-logs a
  // fresh id if the condition recurs after it clears.
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(() => new Set());
  const visibleAlerts = proctoringAlerts.filter(a => !dismissedIds.has(a.id));

  const handleCloseProctoringModal = () => {
    setProctoringModalAlert(null);
  };
  const handleMarkLegitimate = () => {
    if (proctoringModalAlert) {
      setDismissedIds(prev => new Set(prev).add(proctoringModalAlert.id));
      enqueueSnackbar(`Alerta de ${stripTeacherSuffix(proctoringModalAlert.identity)} marcada como legítima`, {
        variant: 'success',
      });
    }
    setProctoringModalAlert(null);
  };
  const handleSendWarning = () => {
    if (proctoringModalAlert) {
      onSendWarning?.(proctoringModalAlert.identity, proctoringModalAlert.kind);
      setDismissedIds(prev => new Set(prev).add(proctoringModalAlert.id));
      enqueueSnackbar(`Advertencia enviada a ${stripTeacherSuffix(proctoringModalAlert.identity)}`, {
        variant: 'warning',
      });
    }
    setProctoringModalAlert(null);
  };

  return (
    <section className={classes.root} data-testid="professor-room-shell-root">
      <SessionStatusBar sessionName={sessionName} studentCount={studentCount} recording={recording} />
      <div
        className={clsx(classes.body, {
          [classes.bodyBoth]: leftOpen && rightOpen,
          [classes.bodyLeftOnly]: leftOpen && !rightOpen,
          [classes.bodyRightOnly]: !leftOpen && rightOpen,
          [classes.bodyNoRails]: !leftOpen && !rightOpen,
        })}
      >
        {/* ── LEFT RAIL ── (always mounted so it can animate open/closed) */}
        <ProfessorLeftRail
          open={leftOpen}
          onClose={onCloseLeft}
          participantCount={participantCount}
          participants={participants}
          attentionByIdentity={attentionByIdentity}
          handsRaised={handsRaised}
          onGrantTurn={onGrantTurn}
          onMuteParticipant={onMuteParticipant}
          notifications={notifications}
          proctoringEnabled={proctoringEnabled}
          visibleAlerts={visibleAlerts}
          source={source}
          onAlertClick={setProctoringModalAlert}
        />

        {/* ── CENTER STAGE ── */}
        <div className={classes.center} data-testid="professor-room-shell-center-stage">
          <div className={classes.stageContent}>{stage}</div>
        </div>

        {/* ── RIGHT RAIL ── (always mounted so it can animate open/closed) */}
        <ProfessorRightRail
          open={rightOpen}
          onClose={onCloseRight}
          rightTab={rightTab}
          onRightTabChange={onRightTabChange}
          groupAttention={groupAttention}
          groupDataAvailable={groupDataAvailable}
          attentionThreshold={attentionThreshold}
          isGroupBelowThreshold={isGroupBelowThreshold}
          timeline={timeline}
          attentionLevel={attentionLevel}
          sortedParticipants={sortedParticipants}
          onOpenReport={handleOpenReport}
          rightPanel={rightPanel}
        />
      </div>

      {/* ── TOOLBAR (full-width footer, always screen-centered) ── */}
      <div className={classes.toolbar} data-testid="professor-room-shell-toolbar-slot">
        {toolbarSlot}
      </div>

      {/* ── PROCTORING MODAL ── */}
      {proctoringModalAlert && (
        <ProctoringAlertModal
          alert={proctoringModalAlert}
          onClose={handleCloseProctoringModal}
          onMarkLegitimate={handleMarkLegitimate}
          onSendWarning={handleSendWarning}
        />
      )}
    </section>
  );
}
