import React, { useState, useRef, useCallback } from 'react';
import { makeStyles, Typography, Button, MenuItem, Link } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useAppState } from '../../../state';
import UserAvatar from './UserAvatar/UserAvatar';
import Menu from '@material-ui/core/Menu';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

// Flows inline inside the IntroContainer header (light background) — it must not
// position itself; the header's flex layout places it after the info chips.
const useStyles = makeStyles({
  userContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  userButton: {
    color: '#1d2f6f',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    fontSize: 14,
    textTransform: 'none',
    whiteSpace: 'nowrap',
  },
  logoutLink: {
    color: '#1d6eed',
    cursor: 'pointer',
    padding: '10px 20px',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    fontSize: 14,
    whiteSpace: 'nowrap',
  },
});

const UserMenu: React.FC = () => {
  const classes = useStyles();
  const { user, signOut } = useAppState();
  const { localTracks } = useVideoContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = useCallback(() => {
    localTracks.forEach(track => track.stop());
    signOut?.();
  }, [localTracks, signOut]);

  if (process.env.REACT_APP_SET_AUTH === 'passcode') {
    return (
      <div className={classes.userContainer}>
        <Link onClick={handleSignOut} className={classes.logoutLink}>
          Cerrar sesión
        </Link>
      </div>
    );
  }

  if (process.env.REACT_APP_SET_AUTH === 'firebase') {
    return (
      <div className={classes.userContainer}>
        <UserAvatar user={user} />
        <Button onClick={() => setMenuOpen(isOpen => !isOpen)} ref={anchorRef} className={classes.userButton}>
          {user!.displayName}
          <ExpandMoreIcon />
        </Button>
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(isOpen => !isOpen)}
          anchorEl={anchorRef.current}
          getContentAnchorEl={null}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
        >
          <MenuItem onClick={handleSignOut}>
            <Typography variant="body1">Cerrar sesión</Typography>
          </MenuItem>
        </Menu>
      </div>
    );
  }

  return null;
};

export default UserMenu;
