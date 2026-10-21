import React from 'react';
import { makeStyles } from '@material-ui/core';
import { useSnackbar } from 'notistack';
import { useAttention } from '../../AttentionProvider';
import { stripTeacherSuffix } from '../../../classSession/classSessionTypes';
import { ProctoringAlert } from '../../AttentionProvider/types';
import { ShellNotification } from '../shellNotification';
import { buildReportViewData } from '../../AttentionReport/buildReportViewData';
import RoomShellLayout from '../ShellLayout/RoomShellLayout';
import SessionStatusBar from './SessionStatusBar';
import ProfessorLeftRail from './ProfessorLeftRail';
import ProfessorRightRail from './ProfessorRightRail';
import ProctoringAlertModal from './ProctoringAlertModal';
import LiveReportModal from './LiveReportModal';
import { ProfessorRightTab } from './professorShellHelpers';

const useStyles = makeStyles(() => ({
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
  /** Professor action: ask the named student to turn their microphone on (roster kebab). */
  onRequestUnmute?: (identity: string) => void;
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
  onRequestUnmute,
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
    fullTimeline,
    participants: attentionParticipants,
    proctoringAlerts,
    proctoringLog,
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

  // Live report modal (Feature 3): reopens the full AttentionReportView in-room,
  // fed directly from useAttention() via buildReportViewData — no localStorage
  // snapshot, no new tab. The post-session /report flow (fetch-by-id, new tab)
  // stays untouched and additive.
  const [isLiveReportOpen, setIsLiveReportOpen] = React.useState(false);
  const handleOpenReport = () => {
    setIsLiveReportOpen(true);
  };
  const handleCloseLiveReport = () => {
    setIsLiveReportOpen(false);
  };
  // Only built while the modal is actually open, so a closed report doesn't pay
  // for the normalization work on every attention tick.
  const liveReportViewData = isLiveReportOpen
    ? buildReportViewData({
        sessionName,
        // The cumulative attendance roster, so the live "Ver reporte" overlay
        // agrees with the final persisted report even after students have left
        // — distinct from `studentCount` above, which is the "who's here right
        // now" count fed to the live SessionStatusBar header.
        studentCount: attentionParticipants.length,
        source,
        groupAttention,
        groupDataAvailable,
        attentionThreshold,
        timeline: fullTimeline,
        participants: attentionParticipants,
        // The live feed is TTL-pruned; the report keeps the full log.
        proctoringAlerts: proctoringLog ?? proctoringAlerts,
        attentionLevel,
        reportDate: new Date(),
      })
    : null;

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
    <RoomShellLayout
      variant="professor"
      testIdPrefix="professor-room-shell"
      statusBar={<SessionStatusBar sessionName={sessionName} studentCount={studentCount} recording={recording} />}
      leftOpen={leftOpen}
      rightOpen={rightOpen}
      /* Rails are always mounted so they can animate open/closed. */
      leftRail={
        <ProfessorLeftRail
          open={leftOpen}
          onClose={onCloseLeft}
          participantCount={participantCount}
          participants={participants}
          attentionByIdentity={attentionByIdentity}
          handsRaised={handsRaised}
          onGrantTurn={onGrantTurn}
          onMuteParticipant={onMuteParticipant}
          onRequestUnmute={onRequestUnmute}
          notifications={notifications}
          proctoringEnabled={proctoringEnabled}
          visibleAlerts={visibleAlerts}
          source={source}
          onAlertClick={setProctoringModalAlert}
        />
      }
      center={
        <div className={classes.center} data-testid="professor-room-shell-center-stage">
          <div className={classes.stageContent}>{stage}</div>
        </div>
      }
      rightRail={
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
      }
      toolbar={toolbarSlot}
    >
      {/* ── PROCTORING MODAL ── */}
      {proctoringModalAlert && (
        <ProctoringAlertModal
          alert={proctoringModalAlert}
          onClose={handleCloseProctoringModal}
          onMarkLegitimate={handleMarkLegitimate}
          onSendWarning={handleSendWarning}
        />
      )}

      {/* ── LIVE REPORT MODAL ── */}
      {isLiveReportOpen && liveReportViewData && (
        <LiveReportModal data={liveReportViewData} onClose={handleCloseLiveReport} />
      )}
    </RoomShellLayout>
  );
}
