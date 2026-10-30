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
import { useTranslation } from 'react-i18next';
import { TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { localizeNotification } from './notificationLocalization';

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

// Translate on render so errors follow language changes.
const errorCopy: Array<{ key: keyof Props; copyKey: string }> = [
  { key: 'refreshError', copyKey: 'errors.refresh' },
  { key: 'paginationError', copyKey: 'errors.pagination' },
  { key: 'readError', copyKey: 'errors.read' },
  { key: 'markAllError', copyKey: 'errors.markAll' },
  { key: 'clearError', copyKey: 'errors.clear' },
  { key: 'reconcileError', copyKey: 'errors.reconcile' },
];

export default function NotificationDropdown(props: Props) {
  const classes = useStyles();
  const { t } = useTranslation('dashboardShell');
  const { t: notificationT } = useTranslation('completeNotifications');
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
        <Typography className={classes.heading}>{t('notificationDropdown.title')}</Typography>
        <IconButton
          size="small"
          aria-label={t('notificationDropdown.moreOptions')}
          data-testid="notification-dropdown-menu-button"
          onClick={event => setMenuAnchor(event.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
          <MenuItem onClick={handleMarkAllRead} disabled={unreadCount === 0 || mutationPending}>
            {t('notificationDropdown.markAllRead')}
          </MenuItem>
          <MenuItem onClick={handleClearAll} disabled={notifications.length === 0 || mutationPending}>
            {t('notificationDropdown.clearAll')}
          </MenuItem>
        </Menu>
      </div>
      <Divider />
      {!hasConfirmedState ? (
        <div className={classes.state} data-testid="notification-dropdown-loading">
          <CircularProgress size={24} aria-label={t('notificationDropdown.loading')} />
        </div>
      ) : notifications.length === 0 ? (
        <div className={classes.state} data-testid="notification-dropdown-empty">
          <CheckCircleOutlineIcon className={classes.stateIcon} />
          {t('notificationDropdown.allCaughtUp')}
        </div>
      ) : (
        <List disablePadding className={classes.list}>
          {notifications.map(notification => {
            const localized = localizeNotification(notification, notificationT);
            return <ListItem
              button
              key={notification.notificationId}
              data-testid={`notification-row-${notification.notificationId}`}
              aria-label={`${localized.title}. ${localized.message}. ${notificationT(notification.readAtMs === null ? 'unread' : 'read')}`}
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
                primary={localized.title}
                secondary={<span className={classes.message}>{localized.message}</span>}
              />
            </ListItem>;
          })}
        </List>
      )}
      <div className={classes.errors}>
        {errorCopy.map(error =>
          props[error.key] ? (
            <Typography key={error.key} className={classes.error} variant="caption" role="alert">
              {t(`notificationDropdown.${error.copyKey}`)}
            </Typography>
          ) : null
        )}
      </div>
      {hasConfirmedState && unreadCount > 0 && (
        <Typography className={classes.warning} variant="caption">
          {t('notificationDropdown.unreadWarning')}
        </Typography>
      )}
      {hasConfirmedState && hasMore && (
        <>
          <Divider />
          <div className={classes.actions}>
            <Button onClick={onLoadMore} disabled={isLoadingMore || mutationPending}>
              {t('notificationDropdown.loadMore')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
