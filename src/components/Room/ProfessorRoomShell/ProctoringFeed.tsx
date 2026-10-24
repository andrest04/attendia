import React from 'react';
import { makeStyles } from '@material-ui/core';
import { ProctoringAlert } from '../../AttentionProvider/types';
import { PROCTORING_KINDS } from '../../AttentionProvider/proctoring';
import { stripTeacherSuffix } from '../../../classSession/classSessionTypes';
import { proctoringKindIcon } from './professorShellHelpers';
import { t } from '../../../i18n/translate';

const useStyles = makeStyles(() => ({
  proctoringFeed: {
    borderTop: '1px solid #e2ecf9',
    padding: '12px 18px',
    flexShrink: 0,
  },
  proctoringFeedTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 11,
    color: '#1d2f6f',
    marginBottom: 8,
  },
  proctoringAlertCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 10px',
    borderRadius: 6,
    backgroundColor: '#fff8e1',
    marginBottom: 6,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#fef3c7',
    },
  },
  proctoringAlertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontSize: 12,
    fontWeight: 600,
    color: '#7c4e00',
  },
  proctoringAlertMeta: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter, sans-serif',
  },
}));

interface ProctoringFeedProps {
  /** Alerts not yet resolved by the professor (parent filters out dismissed ones). */
  visibleAlerts: ProctoringAlert[];
  /**
   * Unused: the in-room feed never shows simulated data any more. Kept only until the
   * left rail stops passing it.
   */
  source?: 'mock' | 'live';
  /** Open the proctoring detail modal for the clicked alert. */
  onAlertClick: (alert: ProctoringAlert) => void;
}

/**
 * The left-rail proctoring alerts feed. The container renders it only when
 * proctoring is enabled; each card opens the detail modal via onAlertClick.
 */
export default function ProctoringFeed({ visibleAlerts, onAlertClick }: ProctoringFeedProps) {
  const classes = useStyles();

  return (
    <div className={classes.proctoringFeed} data-testid="professor-room-shell-proctoring-feed">
      <div className={classes.proctoringFeedTitle}>
        {t('Alertas de proctoring ({{count}})', { count: visibleAlerts.length })}
      </div>
      {visibleAlerts.map(alert => {
        const KindIcon = proctoringKindIcon[alert.kind];
        return (
          <div
            key={alert.id}
            className={classes.proctoringAlertCard}
            onClick={() => onAlertClick(alert)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onAlertClick(alert)}
          >
            <div className={classes.proctoringAlertHeader}>
              <KindIcon style={{ fontSize: 15, color: '#b45309' }} />
              <span>{stripTeacherSuffix(alert.identity)}</span>
            </div>
            <span className={classes.proctoringAlertMeta}>
              {t(PROCTORING_KINDS[alert.kind].label)} · {alert.detectedAt}
            </span>
          </div>
        );
      })}
    </div>
  );
}
