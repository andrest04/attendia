import React from 'react';
import {
  Button,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
  },
  heading: {
    padding: theme.spacing(2, 2, 1),
    fontWeight: 700,
  },
  state: {
    minHeight: 92,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  row: {
    alignItems: 'flex-start',
    borderLeft: '3px solid transparent',
  },
  unread: {
    backgroundColor: '#f3f7ff',
    borderLeftColor: theme.palette.primary.main,
  },
  message: {
    display: 'block',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  errors: {
    padding: theme.spacing(0, 2),
  },
  error: {
    color: theme.palette.error.main,
    margin: theme.spacing(1, 0),
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: theme.spacing(1),
  },
  warning: {
    color: '#9a5b00',
    padding: theme.spacing(0.5, 1),
  },
}));

interface Props {
  notifications: TeacherNotification[];
  unreadCount: number;
  hasConfirmedState: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  pendingReadId: string | null;
  isMarkingAll: boolean;
  isClearing: boolean;
  refreshError: Error | null;
  paginationError: Error | null;
  readError: Error | null;
  markAllError: Error | null;
  clearError: Error | null;
  reconcileError: Error | null;
  onNotificationClick(notification: TeacherNotification): void;
  onLoadMore(): void;
  onMarkAllRead(): void;
  onClearAll(): void;
}

const errorCopy: Array<{ key: keyof Props; copy: string }> = [
  { key: 'refreshError', copy: 'No pudimos actualizar las notificaciones.' },
  { key: 'paginationError', copy: 'No pudimos cargar más notificaciones.' },
  { key: 'readError', copy: 'No pudimos marcar la notificación como leída.' },
  { key: 'markAllError', copy: 'No pudimos marcar todas como leídas.' },
  { key: 'clearError', copy: 'No pudimos vaciar las notificaciones.' },
  { key: 'reconcileError', copy: 'No pudimos sincronizar las notificaciones.' },
];

export default function NotificationDropdown(props: Props) {
  const classes = useStyles();
  const {
    notifications,
    unreadCount,
    hasConfirmedState,
    hasMore,
    isLoadingMore,
    pendingReadId,
    isMarkingAll,
    isClearing,
    onNotificationClick,
    onLoadMore,
    onMarkAllRead,
    onClearAll,
  } = props;
  const mutationPending = isMarkingAll || isClearing;

  return (
    <div className={classes.root} data-testid="notification-dropdown">
      <Typography className={classes.heading}>Notificaciones</Typography>
      <Divider />
      {!hasConfirmedState ? (
        <div className={classes.state} data-testid="notification-dropdown-loading">
          <CircularProgress size={24} aria-label="Cargando notificaciones" />
        </div>
      ) : notifications.length === 0 ? (
        <div className={classes.state} data-testid="notification-dropdown-empty">
          Estás al día
        </div>
      ) : (
        <List disablePadding>
          {notifications.map(notification => (
            <ListItem
              button
              key={notification.notificationId}
              data-testid={`notification-row-${notification.notificationId}`}
              className={`${classes.row} ${notification.readAtMs === null ? classes.unread : ''}`}
              disabled={pendingReadId === notification.notificationId || mutationPending}
              onClick={() => onNotificationClick(notification)}
            >
              <ListItemText
                primary={notification.title}
                secondary={<span className={classes.message}>{notification.message}</span>}
              />
            </ListItem>
          ))}
        </List>
      )}
      <div className={classes.errors}>
        {errorCopy.map(error =>
          props[error.key] ? (
            <Typography key={error.key} className={classes.error} variant="caption" role="alert">
              {error.copy}
            </Typography>
          ) : null
        )}
      </div>
      {hasConfirmedState && (
        <>
          <Divider />
          <div className={classes.actions}>
            {hasMore && (
              <Button onClick={onLoadMore} disabled={isLoadingMore || mutationPending}>
                Cargar más
              </Button>
            )}
            <Button onClick={onMarkAllRead} disabled={unreadCount === 0 || mutationPending}>
              Marcar todas como leídas
            </Button>
            {unreadCount > 0 && (
              <Typography className={classes.warning} variant="caption">
                Tienes notificaciones sin leer
              </Typography>
            )}
            <Button onClick={onClearAll} disabled={notifications.length === 0 || mutationPending}>
              Vaciar notificaciones
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
