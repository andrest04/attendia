import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { DashboardStat, UpcomingSession } from './types';
import { statCardIcon } from './dashboardHelpers';
import { toClassSessionDisplayName, toClassSessionRoomName } from '../PreJoinScreens/classSessionTypes';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    padding: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(2.5),
    marginBottom: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2.5),
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ebf3ff',
    color: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 800,
    fontSize: '1.375rem',
    color: theme.palette.text.primary,
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2.5),
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  sectionTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.125rem',
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  newClassButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    flexShrink: 0,
  },
  sessionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing(2.5),
  },
  sessionCard: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2.5),
  },
  sessionCardHighlighted: {
    border: `2px solid ${theme.palette.primary.main}`,
  },
  sessionBadges: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  badgeToday: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  badgeRelative: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    backgroundColor: '#ebf3ff',
    color: theme.palette.primary.main,
  },
  sessionTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  sessionCode: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  sessionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  primaryButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  secondaryButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    cursor: 'pointer',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
}));

interface Props {
  stats: DashboardStat[];
  dateLabel: string;
  sessions: UpcomingSession[];
  professorName: string;
  onStartClass: (session: { roomName: string; name: string }) => void;
}

/** "Clases" tab: stat cards + the upcoming-sessions grid. The highlighted card's
 * "Iniciar sesión" is the only real CTA in the whole dashboard this pass. */
export default function ClassesTab({ stats, dateLabel, sessions, professorName, onStartClass }: Props) {
  const classes = useStyles();

  const handleStartClass = (session: UpcomingSession) => {
    onStartClass({
      roomName: toClassSessionRoomName(session.title),
      name: toClassSessionDisplayName(professorName, 'teacher'),
    });
  };

  return (
    <div className={classes.root} data-testid="dashboard-classes-tab">
      <div className={classes.statsGrid}>
        {stats.map(stat => {
          const Icon = statCardIcon[stat.icon];
          return (
            <div key={stat.id} className={classes.statCard} data-testid={`dashboard-stat-${stat.id}`}>
              <span className={classes.statIconWrap}>
                <Icon style={{ fontSize: 22 }} />
              </span>
              <div>
                <div className={classes.statValue}>{stat.value}</div>
                <div className={classes.statLabel}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={classes.sectionHeader}>
        <div>
          <div className={classes.sectionTitle}>Próximas sesiones</div>
          <div className={classes.sectionSubtitle}>{dateLabel}</div>
        </div>
        <button type="button" className={classes.newClassButton} data-testid="dashboard-new-class-button">
          <AddIcon style={{ fontSize: 18 }} />
          Nueva clase
        </button>
      </div>

      <div className={classes.sessionsGrid}>
        {sessions.map(session => (
          <div
            key={session.id}
            className={clsx(classes.sessionCard, { [classes.sessionCardHighlighted]: session.highlighted })}
            data-testid={`dashboard-session-card-${session.id}`}
          >
            <div className={classes.sessionBadges}>
              <span className={classes.badgeToday}>{session.dayLabel}</span>
              <span className={classes.badgeRelative}>{session.relativeLabel}</span>
            </div>
            <div className={classes.sessionTitle}>{session.title}</div>
            <div className={classes.sessionCode}>{session.code}</div>
            <div className={classes.sessionMeta}>
              <span className={classes.metaItem}>
                <AccessTimeIcon style={{ fontSize: 16 }} />
                {session.time}
              </span>
              <span className={classes.metaItem}>
                <PeopleAltIcon style={{ fontSize: 16 }} />
                {session.studentCount}
              </span>
            </div>
            {session.highlighted ? (
              <button
                type="button"
                className={classes.primaryButton}
                onClick={() => handleStartClass(session)}
                data-testid="dashboard-start-session-button"
              >
                <PlayArrowIcon style={{ fontSize: 18 }} />
                Iniciar sesión
              </button>
            ) : (
              <button type="button" className={classes.secondaryButton} data-testid="dashboard-view-details-button">
                <OpenInNewIcon style={{ fontSize: 16 }} />
                Ver detalles
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
