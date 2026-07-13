import React from 'react';
import { makeStyles } from '@material-ui/core';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import WarningIcon from '@material-ui/icons/Warning';
import { ProctoringAlert } from '../../AttentionProvider/types';
import { proctoringKindLabel } from '../../AttentionProvider/attentionLabels';
import { attentionStatusColors } from '../../../theme';
import { stripTeacherSuffix } from '../../PreJoinScreens/classSessionTypes';
import { getInitials, proctoringKindIcon, proctoringKindMessage } from './professorShellHelpers';

const useStyles = makeStyles(() => ({
  modalBackdrop: {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    backgroundColor: 'rgba(15,30,69,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    width: 460,
    maxWidth: '90vw',
    borderLeft: `4px solid ${attentionStatusColors.medium}`,
    // Cap height and scroll so the footer actions stay reachable on short viewports.
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid #e2ecf9',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalHeaderLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff8e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 18,
  },
  modalTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 15,
    color: '#1d2f6f',
    lineHeight: 1.3,
  },
  modalCaption: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter, sans-serif',
    marginTop: 2,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: 20,
    lineHeight: 1,
    padding: '2px 6px',
    borderRadius: 4,
    flexShrink: 0,
    '&:hover': { color: '#1d2f6f', backgroundColor: '#f0f5ff' },
  },
  modalBody: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  studentCard: {
    display: 'flex',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e2ecf9',
    backgroundColor: '#f8fbff',
    alignItems: 'flex-start',
  },
  studentCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1d2f6f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#ffffff',
    flexShrink: 0,
  },
  studentCardInfo: {
    flex: 1,
  },
  studentCardName: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#1d2f6f',
  },
  studentCardRole: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter, sans-serif',
    marginBottom: 6,
  },
  alertBox: {
    backgroundColor: '#fff8e1',
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  alertBoxIcon: {
    fontSize: 14,
    color: '#ffb800',
    flexShrink: 0,
    marginTop: 1,
  },
  alertBoxText: {
    fontSize: 12,
    color: '#7c4e00',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.4,
  },
  modalFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #e2ecf9',
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  btnOutlined: {
    padding: '9px 18px',
    borderRadius: 8,
    border: '1.5px solid #e2ecf9',
    backgroundColor: '#ffffff',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    color: '#1d2f6f',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    '&:hover': { backgroundColor: '#f0f5ff', borderColor: '#1d2f6f' },
  },
  btnPrimary: {
    padding: '9px 18px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#1d6eed',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    color: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    '&:hover': { backgroundColor: '#1557c8' },
  },
}));

interface ProctoringAlertModalProps {
  /** The alert to display. The parent guards on non-null before rendering. */
  alert: ProctoringAlert;
  onClose: () => void;
  onMarkLegitimate: () => void;
  onSendWarning: () => void;
}

/**
 * The proctoring alert detail modal — student card + kind-specific message and the
 * two professor actions (mark legitimate / send warning). Purely presentational;
 * all state (which alert, dismissals, snackbars) lives in ProfessorRoomShell.
 */
export default function ProctoringAlertModal({
  alert,
  onClose,
  onMarkLegitimate,
  onSendWarning,
}: ProctoringAlertModalProps) {
  const classes = useStyles();
  const KindIcon = proctoringKindIcon[alert.kind];

  return (
    <div className={classes.modalBackdrop} data-testid="professor-proctoring-modal">
      <div className={classes.modalCard}>
        <div className={classes.modalHeader}>
          <div className={classes.modalHeaderLeft}>
            <div className={classes.modalHeaderIcon}>
              <KindIcon style={{ fontSize: 20, color: '#b45309' }} />
            </div>
            <div>
              <div className={classes.modalTitle}>{proctoringKindLabel[alert.kind]}</div>
              <div className={classes.modalCaption}>Proctoring</div>
            </div>
          </div>
          <button
            type="button"
            className={classes.modalClose}
            aria-label="Cerrar"
            onClick={onClose}
            data-testid="professor-proctoring-modal-close"
          >
            ×
          </button>
        </div>

        <div className={classes.modalBody}>
          <div className={classes.studentCard}>
            <div className={classes.studentCardAvatar}>{getInitials(alert.identity)}</div>
            <div className={classes.studentCardInfo}>
              <div className={classes.studentCardName}>{stripTeacherSuffix(alert.identity)}</div>
              <div className={classes.studentCardRole}>Estudiante · Sesión activa</div>
              <div className={classes.alertBox}>
                <WarningIcon className={classes.alertBoxIcon} style={{ fontSize: 14, color: attentionStatusColors.medium }} />
                <span className={classes.alertBoxText}>
                  {proctoringKindMessage(alert.kind, stripTeacherSuffix(alert.identity), alert.detectedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={classes.modalFooter}>
          <button
            type="button"
            className={classes.btnOutlined}
            onClick={onMarkLegitimate}
            data-testid="professor-proctoring-modal-legitimate"
          >
            <CheckCircleOutlineIcon style={{ fontSize: 16, color: attentionStatusColors.high }} />
            Marcar como legítimo
          </button>
          <button
            type="button"
            className={classes.btnPrimary}
            onClick={onSendWarning}
            data-testid="professor-proctoring-modal-warning"
          >
            ⚠ Enviar advertencia
          </button>
        </div>
      </div>
    </div>
  );
}
