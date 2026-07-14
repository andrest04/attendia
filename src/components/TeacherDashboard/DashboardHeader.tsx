import React, { useState } from 'react';
import { Button, Menu, MenuItem } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import NotificationsNoneIcon from '@material-ui/icons/NotificationsNone';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useHistory } from 'react-router-dom';
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
    position: 'relative',
  },
  // Rendered as a <button> so the logo can act as a "go home" control (only
  // when onLogoClick is passed — see the prejoin header usage).
  logoButton: {
    display: 'flex',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    font: 'inherit',
    '&:focus-visible': {
      outline: '2px solid #1d6eed',
      outlineOffset: 4,
      borderRadius: 6,
    },
  },
  // Centered "Clase: X" label for the pre-session (device-check) header variant.
  centerLabel: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontSize: 15,
    fontWeight: 500,
    color: '#64748b',
    whiteSpace: 'nowrap',
    [theme.breakpoints.down('xs')]: {
      display: 'none',
    },
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
    cursor: 'pointer',
  },
  // Non-interactive fallback when the profile menu would otherwise have no items
  // (no "Perfil" link and no extra items) — an avatar+name chip with no dropdown.
  profileStatic: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  // MUI Button wraps children in an inner .MuiButton-label span that inherits
  // `display` from the root but not `gap` — so the gap has to live here, not on
  // the root, or the avatar/name/chevron render flush against each other.
  profileLabel: {
    gap: theme.spacing(1),
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
  professorName?: string;
  professorInitials?: string;
  // Real user photo (e.g. Google sign-in avatar). Falls back to the initials
  // chip when absent, mirroring UserAvatar in the lobby's UserMenu.
  professorPhotoURL?: string;
  // Students use the same control model but retain their amber identity in the
  // shared header rather than inheriting the teacher's blue avatar treatment.
  identityColor?: 'teacher' | 'student';
  // Wraps the logo in a "go home" button (prejoin header only — the dashboard
  // renders the logo as a plain mark).
  onLogoClick?: () => void;
  // Hides the bell AND the profile chip/menu entirely (only the logo — and
  // centerLabel/badge if present — render).
  showProfile?: boolean;
  // Independently controls just the bell icon.
  showNotifications?: boolean;
  // Centered "Clase: <name>" label (prejoin header only).
  centerLabel?: React.ReactNode;
  // Pill rendered before the bell/profile (e.g. the "Pre-sesión" pill).
  badge?: React.ReactNode;
  // Hides the "Perfil" menu item when that navigation is unavailable in the current flow.
  showProfileLink?: boolean;
  // Lets prejoin release acquired media before navigating to the profile.
  onProfileClick?: () => void;
  // Extra <MenuItem>s rendered after "Perfil" (e.g. sign-out, on the prejoin header).
  extraMenuItems?: React.ReactNode;
}

/** Top bar shared by every Panel Docente tab and the prejoin flow: brand, notifications, profile chip. */
export default function DashboardHeader({
  professorName,
  professorInitials,
  professorPhotoURL,
  identityColor = 'teacher',
  onLogoClick,
  showProfile = true,
  showNotifications = true,
  centerLabel,
  badge,
  showProfileLink = true,
  onProfileClick,
  extraMenuItems,
}: Props) {
  const classes = useStyles();
  const history = useHistory();
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<HTMLElement | null>(null);

  const openProfile = () => {
    setProfileMenuAnchor(null);
    if (onProfileClick) onProfileClick();
    else history.push('/profile');
  };

  const logo = <AttendiaLogo variant="full" size={28} />;
  const hasMenuItems = showProfileLink || Boolean(extraMenuItems);

  return (
    <header className={classes.root} data-testid="dashboard-header">
      {onLogoClick ? (
        <button type="button" className={classes.logoButton} onClick={onLogoClick} aria-label="Ir al inicio">
          {logo}
        </button>
      ) : (
        logo
      )}
      {centerLabel && <span className={classes.centerLabel}>{centerLabel}</span>}
      <div className={classes.right}>
        {badge}
        {showProfile && showNotifications && (
          <span className={classes.bell} data-testid="dashboard-header-notifications" aria-label="Notificaciones">
            <NotificationsNoneIcon />
          </span>
        )}
        {showProfile && hasMenuItems && (
          <>
            <Button
              className={classes.profile}
              classes={{ label: classes.profileLabel }}
              data-testid="dashboard-header-profile"
              aria-label="Abrir menú de perfil"
              aria-controls={profileMenuAnchor ? 'dashboard-profile-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={Boolean(profileMenuAnchor)}
              onClick={event => setProfileMenuAnchor(event.currentTarget)}
            >
              {professorPhotoURL ? (
                <span
                  className={`${classes.avatar} ${classes.avatarPhoto}`}
                  style={{
                    backgroundImage: `url(${professorPhotoURL})`,
                    border: `2px solid ${identityColor === 'student' ? '#d97706' : '#1d6eed'}`,
                  }}
                  data-testid="dashboard-header-avatar-photo"
                />
              ) : (
                <span
                  className={classes.avatar}
                  style={identityColor === 'student' ? { backgroundColor: '#d97706' } : undefined}
                  data-testid="dashboard-header-avatar-initials"
                >
                  {professorInitials}
                </span>
              )}
              <span className={classes.name}>{professorName}</span>
              <ExpandMoreIcon className={classes.chevron} />
            </Button>
            <Menu
              id="dashboard-profile-menu"
              anchorEl={profileMenuAnchor}
              keepMounted
              open={Boolean(profileMenuAnchor)}
              onClose={() => setProfileMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              getContentAnchorEl={null}
            >
              {showProfileLink && (
                <MenuItem onClick={openProfile} data-testid="dashboard-profile-menu-item">
                  Perfil
                </MenuItem>
              )}
              {extraMenuItems}
            </Menu>
          </>
        )}
        {showProfile && !hasMenuItems && (
          <span className={classes.profileStatic} data-testid="dashboard-header-profile-static">
            {professorPhotoURL ? (
              <span
                className={`${classes.avatar} ${classes.avatarPhoto}`}
                style={{
                  backgroundImage: `url(${professorPhotoURL})`,
                    border: `2px solid ${identityColor === 'student' ? '#d97706' : '#1d6eed'}`,
                }}
                data-testid="dashboard-header-avatar-photo"
              />
            ) : (
              <span
                className={classes.avatar}
                style={identityColor === 'student' ? { backgroundColor: '#d97706' } : undefined}
                data-testid="dashboard-header-avatar-initials"
              >
                {professorInitials}
              </span>
            )}
            <span className={classes.name}>{professorName}</span>
          </span>
        )}
      </div>
    </header>
  );
}
