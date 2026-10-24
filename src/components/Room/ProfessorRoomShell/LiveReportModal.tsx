import React from 'react';
import { makeStyles } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import DescriptionIcon from '@material-ui/icons/Description';
import AttentionReportView, { AttentionReportViewData } from '../../AttentionReport/AttentionReportView';
import { t } from '../../../i18n/translate';

const useStyles = makeStyles(() => ({
  modalBackdrop: {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    backgroundColor: 'rgba(15,30,69,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#f0f5ff',
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    width: '100%',
    maxWidth: 1080,
    // Cap height and scroll so the report body (chart + table) stays reachable
    // without pushing the modal off-screen, same pattern as ProctoringAlertModal.
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '14px 20px',
    borderBottom: '1px solid #e2ecf9',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  modalHeaderIcon: {
    fontSize: 18,
    color: '#1d6eed',
  },
  modalTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 15,
    color: '#1d2f6f',
    flex: 1,
  },
  modalClose: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 8,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    color: '#1d6eed',
    '&:hover': { backgroundColor: '#ebf3ff' },
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  },
}));

interface LiveReportModalProps {
  data: AttentionReportViewData;
  onClose: () => void;
}

/**
 * In-room "Ver reporte" modal — reopens the full AttentionReportView while the
 * class session is still live, fed directly from useAttention() via
 * buildReportViewData (no localStorage snapshot, no new tab; see Feature 3).
 * Structural template mirrors ProctoringAlertModal's absolute overlay scoped to
 * the shell root; header treatment mirrors ReportPage's nav bar.
 */
export default function LiveReportModal({ data, onClose }: LiveReportModalProps) {
  const classes = useStyles();

  return (
    <div className={classes.modalBackdrop} data-testid="professor-live-report-modal">
      <div className={classes.modalCard}>
        <div className={classes.modalHeader}>
          <DescriptionIcon className={classes.modalHeaderIcon} />
          <span className={classes.modalTitle}>{t('Reporte de Atención')}</span>
          <button
            type="button"
            className={classes.modalClose}
            onClick={onClose}
            data-testid="professor-live-report-modal-close"
          >
            <CloseIcon style={{ fontSize: 16 }} />
            {t('Cerrar')}
          </button>
        </div>
        <div className={classes.modalBody}>
          <AttentionReportView data={data} />
        </div>
      </div>
    </div>
  );
}
