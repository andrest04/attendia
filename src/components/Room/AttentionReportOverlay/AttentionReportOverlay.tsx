import React, { useEffect } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';

import { useAttention } from '../../AttentionProvider';
import AttentionReportView, { AttentionReportViewData } from '../../AttentionReport/AttentionReportView';
import { averageOverTime, percentTimeAboveThreshold } from '../../AttentionReport/reportMath';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    position: 'absolute',
    inset: 0,
    zIndex: theme.zIndex.modal,
    backgroundColor: '#f0f5ff',
    overflowY: 'auto',
  },
  // ── Action rows ──────────────────────────────────────────────────────────
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  // Close button in the header (top-right X)
  closeBtn: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
  },
  // "Volver a la sesión" outlined button that replaces the old "Nueva sesión"
  returnBtn: {
    borderRadius: 10,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    padding: '8px 20px',
    textTransform: 'none',
  },
}));

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Human-facing session/room name shown in the header. */
  sessionName: string;
  /** Connected students (excludes the professor) — mirrors the status bar count. */
  studentCount: number;
}

/**
 * In-room full-area attention report overlay. Mounted INSIDE the room so the live
 * Twilio call is never torn down and the real `useAttention()` context stays
 * available; a separate route would unmount VideoProvider and drop the call.
 * This is now just the overlay chrome (backdrop, close affordances) around the
 * shared AttentionReportView, which it feeds from `useAttention()`.
 */
export default function AttentionReportOverlay({ isOpen, onClose, sessionName, studentCount }: Props) {
  const classes = useStyles();
  const {
    source,
    groupAttention,
    groupDataAvailable,
    attentionThreshold,
    timeline,
    participants,
    proctoringAlerts,
    attentionLevel,
  } = useAttention();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  // Build a lookup from identity -> alert count for the table.
  const alertCountByIdentity: Record<string, number> = {};
  proctoringAlerts.forEach(alert => {
    alertCountByIdentity[alert.identity] = (alertCountByIdentity[alert.identity] || 0) + 1;
  });

  // Normalize the live context into the view's data shape. "Índice Prom." is the
  // session average, falling back to the latest index for fixtures/participants
  // without accumulated history (min/max stay undefined → rendered "—").
  const viewData: AttentionReportViewData = {
    sessionName,
    studentCount,
    source,
    attentionThreshold,
    timeline,
    // The group KPIs are honest only when the session recorded real data: either
    // accumulated timeline points, or a live reading at open time.
    hasGroupData: timeline.length > 0 || groupDataAvailable,
    groupAverage: timeline.length > 0 ? averageOverTime(timeline) : groupAttention,
    percentAboveThreshold: percentTimeAboveThreshold(timeline, attentionThreshold),
    participants: participants.map(participant => {
      const avg = participant.indexAvg ?? participant.index;
      return {
        identity: participant.identity,
        indexAvg: avg,
        indexMin: participant.indexMin,
        indexMax: participant.indexMax,
        level: attentionLevel(avg),
        alertCount: alertCountByIdentity[participant.identity] || 0,
      };
    }),
    totalAlerts: proctoringAlerts.length,
    reportDate: new Date(),
  };

  return (
    <div
      className={classes.root}
      role="dialog"
      aria-modal="true"
      aria-label="Reporte de Atención"
      data-testid="attention-report-overlay"
    >
      {/* X close button — top-right corner, always reachable */}
      <IconButton
        className={classes.closeBtn}
        aria-label="Cerrar reporte"
        onClick={onClose}
        data-testid="attention-report-close-x"
      >
        <CloseIcon />
      </IconButton>

      <AttentionReportView
        data={viewData}
        actionsSlot={
          <div className={classes.actionsRow}>
            <Button
              variant="outlined"
              className={classes.returnBtn}
              onClick={onClose}
              data-testid="attention-report-close"
            >
              Volver a la sesión
            </Button>
          </div>
        }
      />
    </div>
  );
}
