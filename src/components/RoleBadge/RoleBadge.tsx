import React from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import SchoolIcon from '@material-ui/icons/School';
import { t } from '../../i18n/translate';

/**
 * Visual marker for the teacher role. The role is encoded as the `[Profesor]`
 * suffix on the Twilio identity (see classSessionTypes), which is a DATA detail
 * and must never be shown as raw text. This badge is the single presentation of
 * that role — reuse it everywhere the teacher must be identifiable (gallery tile,
 * main view, roster) so the look stays consistent across both shells.
 */
const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.palette.primary.main,
      color: '#FFFFFF',
      borderRadius: 999,
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 700,
      lineHeight: 1,
      whiteSpace: 'nowrap',
    },
    md: {
      padding: '3px 9px',
      fontSize: 12,
      '& svg': { fontSize: 14 },
    },
    sm: {
      padding: '2px 7px',
      fontSize: 10,
      '& svg': { fontSize: 12 },
    },
  })
);

interface RoleBadgeProps {
  /** `sm` for video-tile overlays, `md` (default) for the roster. */
  size?: 'sm' | 'md';
  className?: string;
}

export default function RoleBadge({ size = 'md', className }: RoleBadgeProps) {
  const classes = useStyles();
  return (
    <span
      className={clsx(classes.badge, size === 'sm' ? classes.sm : classes.md, className)}
      data-testid="role-badge-teacher"
    >
      <SchoolIcon />
      {t('Profesor')}
    </span>
  );
}
