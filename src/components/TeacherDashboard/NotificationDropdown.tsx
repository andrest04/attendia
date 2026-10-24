import React, { useState } from 'react';
import {
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Button,
  Typography,
} from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { t } from '../../i18n/translate';
import { notificationText } from './notificationCopy';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 1, 1.5, 2),
  },
  heading: {
    fontWeight: 700,
  },
  state: {
    minHeight: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3, 2),
    color: theme.palette.text.secondary,
  },
  stateIcon: {
    fontSize: 32,
    color: theme.palette.success.main,
    marginBottom: theme.spacing(1),
  },
  list: {
    maxHeight: 320,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    '&::-webkit-scrollbar': {
      width: 6,
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: '#cbd5e1',
      borderRadius: 3,
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
  },
  row: {
    position: 'relative',
    alignItems: 'flex-start',
    borderLeft: '3px solid transparent',
    padding: theme.spacing(1.5, 2),
  },
  unread: {
    backgroundColor: '#f3f7ff',
    borderLeftColor: theme.palette.primary.main,
  },
  unreadDot: {
    position: 'absolute',
    top: theme.spacing(1.5),
    right: theme.spacing(1.5),
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
  },
  message: {
    display: 'block',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  errors: {
    padding: theme.spacing(1, 2),
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
    display: 'block',
    color: '#9a5b00',
    padding: theme.spacing(1, 2),
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
  { key: 'refreshError', copy: t('No pudimos actualizar las notificaciones.') },
  { key: 'paginationError', copy: t('No pudimos cargar más notificaciones.') },
  { key: 'readError', copy: t('No pudimos marcar la notificación como leída.') },
  { key: 'markAllError', copy: t('No pudimos marcar todas como leídas.') },
  { key: 'clearError', copy: t('No pudimos vaciar las notificaciones.') },
  { key: 'reconcileError', copy: t('No pudimos sincronizar las notificaciones.') },
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
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const closeMenu = () => setMenuAnchor(null);
  const handleMarkAllRead = () => {
    closeMenu();
    onMarkAllRead();
  };
  const handleClearAll = () => {
    closeMenu();
    onClearAll();
  };

  return (
    <div className={classes.root} data-testid="notification-dropdown">
      <div className={classes.header}>
        <Typography className={classes.heading}>Notificaciones</Typography>
        <IconButton
          size="small"
          aria-label={t('Más opciones de notificaciones')}
          data-testid="notification-dropdown-menu-button"
          onClick={event => setMenuAnchor(event.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
          <MenuItem onClick={handleMarkAllRead} disabled={unreadCount === 0 || mutationPending}>
            {t('Marcar todas como leídas')}
          </MenuItem>
          <MenuItem onClick={handleClearAll} disabled={notifications.length === 0 || mutationPending}>
            Vaciar notificaciones
          </MenuItem>
        </Menu>
      </div>
      <Divider />
      {!hasConfirmedState ? (
        <div className={classes.state} data-testid="notification-dropdown-loading">
          <CircularProgress size={24} aria-label={t('Cargando notificaciones')} />
        </div>
      ) : notifications.length === 0 ? (
        <div className={classes.state} data-testid="notification-dropdown-empty">
          <CheckCircleOutlineIcon className={classes.stateIcon} />
          {t('Estás al día')}
        </div>
      ) : (
        <List disablePadding className={classes.list}>
          {notifications.map(notification => (
            <ListItem
              button
              key={notification.notificationId}
              data-testid={`notification-row-${notification.notificationId}`}
              className={`${classes.row} ${notification.readAtMs === null ? classes.unread : ''}`}
              disabled={pendingReadId === notification.notificationId || mutationPending}
              onClick={() => onNotificationClick(notification)}
            >
              {notification.readAtMs === null && (
                <span
                  className={classes.unreadDot}
                  data-testid={`notification-row-${notification.notificationId}-unread-dot`}
                />
              )}
              <ListItemText
                primary={notificationText(notification).title}
                secondary={<span className={classes.message}>{notificationText(notification).message}</span>}
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
      {hasConfirmedState && unreadCount > 0 && (
        <Typography className={classes.warning} variant="caption">
          Tienes notificaciones sin leer
        </Typography>
      )}
      {hasConfirmedState && hasMore && (
        <>
          <Divider />
          <div className={classes.actions}>
            <Button onClick={onLoadMore} disabled={isLoadingMore || mutationPending}>
              {t('Cargar más')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
