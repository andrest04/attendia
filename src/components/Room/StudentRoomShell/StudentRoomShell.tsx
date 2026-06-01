import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import { ShellNotification } from './useShellNotifications';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr 320px',
    gridTemplateRows: '1fr',
    width: '100%',
    height: '100%',
    backgroundColor: theme.palette.background.default,
  },
  leftRail: {
    borderRight: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  center: {
    minWidth: 0,
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    overflow: 'hidden',
  },
  stageHeader: {
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: 12,
  },
  stageContent: {
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  toolbar: {
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
  },
  rightRail: {
    borderLeft: `1px solid ${theme.palette.divider}`,
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    minWidth: 0,
  },
  rightTabs: {
    display: 'flex',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    flex: 1,
    padding: theme.spacing(1.25, 2),
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    color: theme.palette.text.secondary,
    cursor: 'pointer',
  },
  tabActive: {
    color: theme.palette.text.primary,
    borderBottomColor: theme.palette.text.primary,
  },
  rightContent: {
    minHeight: 0,
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 12,
    marginBottom: theme.spacing(1),
  },
  section: {
    padding: theme.spacing(1.5),
  },
  notificationsEmpty: {
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  contextLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: theme.spacing(0.5),
  },
  connectivityBanner: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 4,
    backgroundColor: '#FFF8E1',
    color: '#7A4B00',
    fontSize: 12,
  },
}));

interface Props {
  stage: React.ReactNode;
  toolbarSlot?: React.ReactNode;
  rightTab?: 'chat' | 'attention';
  onRightTabChange?: (tab: 'chat' | 'attention') => void;
  rightPanel?: React.ReactNode;
  activeSpeakerLabel?: string;
  sessionLabel?: string;
  participantCount?: number;
  notifications?: ShellNotification[];
  isConnectivityDegraded?: boolean;
}

export default function StudentRoomShell({
  stage,
  toolbarSlot = null,
  rightTab = 'chat',
  onRightTabChange,
  rightPanel = null,
  activeSpeakerLabel = 'Sin participante activo',
  sessionLabel = 'Sesión Twilio en vivo',
  participantCount = 0,
  notifications = [],
  isConnectivityDegraded = false,
}: Props) {
  const classes = useStyles();

  return (
    <section className={classes.root} data-testid="student-room-shell-root">
      <aside className={classes.leftRail} data-testid="student-room-shell-left-rail">
        <div className={classes.section}>
          <div className={classes.sectionTitle}>Participantes</div>
          <div className={classes.contextLine} data-testid="student-room-shell-participant-count">
            {participantCount} en sala
          </div>
        </div>
        <div className={classes.section}>
          <div className={classes.sectionTitle}>Notificaciones</div>
          {notifications.length === 0 ? (
            <div className={classes.notificationsEmpty} data-testid="student-room-shell-notifications-empty">
              Sin actividad por ahora.
            </div>
          ) : (
            notifications.map(notification => <div key={notification.id}>{notification.text}</div>)
          )}
        </div>
      </aside>

      <div className={classes.center} data-testid="student-room-shell-center-stage">
        <header className={classes.stageHeader} data-testid="student-room-shell-stage-header">
          <div>{sessionLabel}</div>
          <div className={classes.contextLine}>Participante activo: {activeSpeakerLabel}</div>
          {isConnectivityDegraded && (
            <div className={classes.connectivityBanner} data-testid="student-room-shell-connectivity-banner">
              Resolución reducida por baja conectividad
            </div>
          )}
        </header>
        <div className={classes.stageContent}>{stage}</div>
        <div className={classes.toolbar} data-testid="student-room-shell-toolbar-slot">
          {toolbarSlot}
        </div>
      </div>

      <aside className={classes.rightRail} data-testid="student-room-shell-right-rail">
        <div className={classes.rightTabs} data-testid="student-room-shell-right-tabs">
          <button
            type="button"
            className={clsx(classes.tab, { [classes.tabActive]: rightTab === 'chat' })}
            data-testid="student-room-shell-tab-chat"
            aria-pressed={rightTab === 'chat'}
            onClick={() => onRightTabChange?.('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            className={clsx(classes.tab, { [classes.tabActive]: rightTab === 'attention' })}
            data-testid="student-room-shell-tab-attention"
            aria-pressed={rightTab === 'attention'}
            onClick={() => onRightTabChange?.('attention')}
          >
            Mi Atención
          </button>
        </div>
        <div className={classes.rightContent}>{rightPanel}</div>
      </aside>
    </section>
  );
}
