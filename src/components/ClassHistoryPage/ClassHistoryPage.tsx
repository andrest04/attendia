import React, { useCallback, useEffect, useState } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import EventIcon from '@material-ui/icons/Event';
import HistoryIcon from '@material-ui/icons/History';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import { useHistory } from 'react-router-dom';

import StandalonePage, { PageNavButton } from '../StandalonePage/StandalonePage';
import AttentionReportView, { AttentionReportViewData } from '../AttentionReport/AttentionReportView';
import { storedReportDate, storedReportToViewData } from '../AttentionReport/storedReportViewData';
import { StoredAttentionReport } from '../AttentionProvider/reportTypes';
import { useAppState } from '../../state';
import { useTranslation } from 'react-i18next';
import { resolveLocale } from '../../i18n/resolveLocale';
import es from '../../i18n/locales/completeReports.es';

/*
 * "Historial de clases" — teacher-facing list of the attention reports persisted
 * when a class session ended (GET /reports). Standalone light page in the same
 * layout language as SecurityPage (#f0f5ff background, white cards, Poppins);
 * lives OUTSIDE VideoApp so it never mounts any SDK provider. Availability is
 * gated twice: here on profile.role for UX, and server-side for real.
 */

const endReasonKey: { [key: string]: 'ended' | 'left' } = {
  'ended-for-all': 'ended',
  left: 'left',
};

const useStyles = makeStyles((theme: Theme) => ({
  page: {
    maxWidth: 1020,
    margin: '0 auto',
    padding: theme.spacing(4, 3, 8),
  },
  pageHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  },
  headingIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#ebf3ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#1d6eed',
  },
  h1: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 800,
    fontSize: '1.5rem',
    color: '#1d2f6f',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    marginBottom: theme.spacing(4),
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    padding: theme.spacing(3, 4),
  },
  centerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    textAlign: 'center',
    padding: theme.spacing(6, 4),
  },
  mutedText: {
    fontSize: '0.875rem',
    color: '#64748b',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  reportCard: {
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    border: '1px solid #e2ecf9',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    padding: theme.spacing(3, 4),
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
    '&:hover': {
      borderColor: '#1d6eed',
      boxShadow: '0px 4px 16px 0px rgba(29,110,237,0.16)',
    },
  },
  reportTitleRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  reportTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: '#1d2f6f',
  },
  mockTag: {
    display: 'inline-block',
    fontSize: '0.6875rem',
    fontStyle: 'italic',
    color: '#64748b',
    padding: '2px 10px',
    borderRadius: 3,
    border: '1px dashed #94a3b8',
  },
  reportMeta: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginBottom: theme.spacing(1.5),
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f5ff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    padding: '7px 15px',
    fontSize: '0.75rem',
    color: '#64748b',
    lineHeight: '18px',
  },
  chipIcon: {
    fontSize: 13,
    color: '#94a3b8',
  },
  detailBackRow: {
    padding: theme.spacing(3, 3, 0),
    maxWidth: 1020,
    margin: '0 auto',
  },
  retryBtn: {
    borderRadius: 10,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    textTransform: 'none',
  },
}));

/** Snapshot date: prefer the resolved server timestamp, fall back to the client clock. */
function formatReportDate(report: StoredAttentionReport, locale: string, noDate: string): string {
  const date = storedReportDate(report);
  if (isNaN(date.getTime())) {
    return noDate;
  }
  const day = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** Adapt a stored report to the shared report view's normalized data shape. */
export function toViewData(report: StoredAttentionReport): AttentionReportViewData {
  return storedReportToViewData(report);
}

export default function ClassHistoryPage() {
  const classes = useStyles();
  const { t, i18n } = useTranslation();
  const text = (key: keyof typeof es.completeReports.history, options: object = {}) =>
    t(`completeReports.history.${key}`, { defaultValue: es.completeReports.history[key], ...options });
  const locale = resolveLocale(i18n.language);
  const history = useHistory();
  const { fetchAttentionReports, profile } = useAppState();

  const [reports, setReports] = useState<StoredAttentionReport[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<{ reason: any } | null>(null);
  const error = failure ? (failure.reason && failure.reason.message) || '__history_load_failed__' : null;
  // Detail view is local state (no sub-route): the data is already in memory.
  const [selected, setSelected] = useState<StoredAttentionReport | null>(null);

  // Available only in firebase mode AND for teachers — same double condition the
  // server enforces for real; this is just the friendly UX gate.
  const isAvailable = Boolean(fetchAttentionReports) && profile?.role === 'teacher';

  const load = useCallback(() => {
    if (!fetchAttentionReports) return;
    setIsLoading(true);
    setFailure(null);
    fetchAttentionReports()
      .then(fetchedReports => {
        setReports(fetchedReports);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('ClassHistoryPage: could not fetch the reports', err);
        setFailure({ reason: err });
        setIsLoading(false);
      });
  }, [fetchAttentionReports]);

  useEffect(() => {
    if (isAvailable) {
      load();
    }
  }, [isAvailable, load]);

  const goBackToLobby = () => history.push('/');

  return (
    <StandalonePage
      testId="class-history-page"
      navStart={
        <PageNavButton
          onClick={goBackToLobby}
          icon={<ChevronLeftIcon style={{ fontSize: 16 }} />}
          testId="class-history-back-to-lobby"
        >
          {text('back')}
        </PageNavButton>
      }
    >
      {selected ? (
        <>
          <div className={classes.detailBackRow}>
            <PageNavButton
              onClick={() => setSelected(null)}
              icon={<ChevronLeftIcon style={{ fontSize: 16 }} />}
              testId="class-history-detail-back"
            >
              {text('backToHistory')}
            </PageNavButton>
          </div>
          <AttentionReportView data={toViewData(selected)} />
        </>
      ) : (
        <Container className={classes.page} maxWidth={false}>
          <div className={classes.pageHeading}>
            <div className={classes.headingIconWrap}>
              <HistoryIcon style={{ fontSize: 22 }} />
            </div>
            <Typography variant="h1" className={classes.h1}>
              {text('title')}
            </Typography>
          </div>
          <Typography className={classes.subtitle}>
            {text('subtitle')}
          </Typography>

          {!isAvailable ? (
            <div className={`${classes.card} ${classes.centerCard}`} data-testid="class-history-unavailable">
              <Typography className={classes.mutedText}>
                {text('unavailable')}
              </Typography>
            </div>
          ) : isLoading ? (
            <div className={`${classes.card} ${classes.centerCard}`} data-testid="class-history-loading">
              <CircularProgress size={28} />
              <Typography className={classes.mutedText}>{text('loading')}</Typography>
            </div>
          ) : error ? (
            <div className={`${classes.card} ${classes.centerCard}`} data-testid="class-history-error">
              <Typography className={classes.mutedText}>{error === '__history_load_failed__' ? text('failure') : error}</Typography>
              <Button variant="outlined" className={classes.retryBtn} onClick={load} data-testid="class-history-retry">
                {text('retry')}
              </Button>
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className={`${classes.card} ${classes.centerCard}`} data-testid="class-history-empty">
              <Typography className={classes.mutedText}>
                {text('empty')}
              </Typography>
            </div>
          ) : (
            <div className={classes.list}>
              {reports.map(report => (
                <button
                  type="button"
                  key={report.roomSid}
                  className={classes.reportCard}
                  onClick={() => setSelected(report)}
                  data-testid="class-history-item"
                >
                  <div className={classes.reportTitleRow}>
                    <span className={classes.reportTitle}>{report.roomName}</span>
                    {report.source === 'mock' && <span className={classes.mockTag}>{t('completeReports.shared.mock', 'Datos simulados')}</span>}
                  </div>
                  <div className={classes.reportMeta}>{endReasonKey[report.endReason] ? text(endReasonKey[report.endReason]) : report.endReason}</div>
                  <div className={classes.chipsRow}>
                    <span className={classes.chip}>
                      <EventIcon className={classes.chipIcon} />
                      {formatReportDate(report, locale, text('noDate'))}
                    </span>
                    <span className={classes.chip}>
                      <PeopleAltIcon className={classes.chipIcon} />
                      {t('completeReports.shared.students', { count: report.studentCount, defaultValue: report.studentCount === 1 ? '{{count}} estudiante' : '{{count}} estudiantes' })}
                    </span>
                    <span className={classes.chip}>{text('average', { value: report.groupAverage })}</span>
                    <span className={classes.chip}>{t('completeReports.shared.alerts', { count: (report.proctoringAlerts || []).length, defaultValue: (report.proctoringAlerts || []).length === 1 ? '{{count}} alerta' : '{{count}} alertas' })}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Container>
      )}
    </StandalonePage>
  );
}
