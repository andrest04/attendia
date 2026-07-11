import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import NotificationsNoneIcon from '@material-ui/icons/NotificationsNone';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AttendiaLogo from '../Brand/AttendiaLogo';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    padding: theme.spacing(0, 3),
    backgroundColor: theme.palette.background.paper,
    borderBottom: '1px solid #e2ecf9',
    flexShrink: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  bell: {
    color: theme.palette.text.secondary,
    display: 'flex',
  },
  profile: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.8125rem',
    flexShrink: 0,
  },
  avatarPhoto: {
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  name: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    // Hide the name (keep avatar + chevron) once the viewport is too narrow for
    // logo + bell + name to coexist without wrapping/overflowing.
    [theme.breakpoints.down('xs')]: {
      display: 'none',
    },
  },
  chevron: {
    color: theme.palette.text.secondary,
    fontSize: 18,
  },
}));

interface Props {
  professorName: string;
  professorInitials: string;
  // Real user photo (e.g. Google sign-in avatar). Falls back to the initials
  // chip when absent, mirroring UserAvatar in the lobby's UserMenu.
  professorPhotoURL?: string;
}

/** Top bar shared by every Panel Docente tab: brand, notifications, profile chip. */
export default function DashboardHeader({ professorName, professorInitials, professorPhotoURL }: Props) {
  const classes = useStyles();

  return (
    <header className={classes.root} data-testid="dashboard-header">
      <AttendiaLogo variant="full" size={28} />
      <div className={classes.right}>
        <span className={classes.bell} data-testid="dashboard-header-notifications" aria-label="Notificaciones">
          <NotificationsNoneIcon />
        </span>
        <div className={classes.profile} data-testid="dashboard-header-profile">
          {professorPhotoURL ? (
            <span
              className={`${classes.avatar} ${classes.avatarPhoto}`}
              style={{ backgroundImage: `url(${professorPhotoURL})` }}
              data-testid="dashboard-header-avatar-photo"
            />
          ) : (
            <span className={classes.avatar} data-testid="dashboard-header-avatar-initials">
              {professorInitials}
            </span>
          )}
          <span className={classes.name}>{professorName}</span>
          <ExpandMoreIcon className={classes.chevron} />
        </div>
      </div>
    </header>
  );
}
