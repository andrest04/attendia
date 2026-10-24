import React from 'react';
import { makeStyles } from '@material-ui/core';
import { ShellNotification } from '../shellNotification';
import { notificationEmoji } from './professorShellHelpers';
import { t } from '../../../i18n/translate';

const useStyles = makeStyles(() => ({
  // A short, persistent log of students joining/leaving. Owns the marginTop:auto
  // push so it (and the proctoring feed stacked below) sit at the bottom of the rail.
  notificationsSection: {
    borderTop: '1px solid #e2ecf9',
    padding: '12px 18px',
    marginTop: 'auto',
    flexShrink: 0,
  },
  notificationsLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
    lineHeight: '15px',
  },
  notificationItems: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  notificationPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f5ff',
    border: '1px solid #e2ecf9',
    borderRadius: 10,
    padding: '8px 11px',
    marginTop: 10,
  },
  notificationEmoji: {
    fontSize: 13,
    lineHeight: '19.5px',
    flexShrink: 0,
  },
  notificationText: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 11,
    color: '#64748b',
    lineHeight: '16.5px',
  },
  notificationsEmpty: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 10,
  },
}));

interface NotificationsFeedProps {
  /** Short, persistent log of classmate join/leave events (capped upstream). */
  notifications: ShellNotification[];
}

/**
 * The left-rail classmate join/leave feed. Always renders (shows an empty state)
 * because its marginTop:auto is what pushes the bottom section down.
 */
export default function NotificationsFeed({ notifications }: NotificationsFeedProps) {
  const classes = useStyles();

  return (
    <div className={classes.notificationsSection} data-testid="professor-room-shell-notifications">
      <div className={classes.notificationsLabel}>{t('Notificaciones')}</div>
      {notifications.length === 0 ? (
        <div className={classes.notificationsEmpty} data-testid="professor-room-shell-notifications-empty">
          {t('Sin actividad por ahora.')}
        </div>
      ) : (
        <div className={classes.notificationItems}>
          {notifications.map(notification => (
            <div key={notification.id} className={classes.notificationPill}>
              <span className={classes.notificationEmoji} aria-hidden="true">
                {notificationEmoji(notification.text)}
              </span>
              <span className={classes.notificationText}>{notification.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
