import React, { useState, useRef, useCallback } from 'react';
import { makeStyles, Typography, Button, MenuItem } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../../state';
import UserAvatar from './UserAvatar/UserAvatar';
import Menu from '@material-ui/core/Menu';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import CreatePasswordDialog from './CreatePasswordDialog/CreatePasswordDialog';

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
});

const UserMenu: React.FC = () => {
  const classes = useStyles();
  const { user, profile, signOut } = useAppState();
  const { localTracks } = useVideoContext();
  const history = useHistory();

  const [menuOpen, setMenuOpen] = useState(false);
  const [createPasswordOpen, setCreatePasswordOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = useCallback(() => {
    localTracks.forEach(track => track.stop());
    signOut?.();
  }, [localTracks, signOut]);

  // Guard defensively because test mocks may not carry email/providerData.
  const firebaseUser = user as { email?: string | null; providerData?: ({ providerId: string } | null)[] } | null;
  const hasPasswordProvider = Boolean(firebaseUser?.providerData?.some(p => p?.providerId === 'password'));
  const canCreatePassword = Boolean(firebaseUser?.email) && !hasPasswordProvider;

  if (!user) {
    return null;
  }

  return (
    <div className={classes.userContainer}>
      <UserAvatar user={user} />
      <Button onClick={() => setMenuOpen(isOpen => !isOpen)} ref={anchorRef} className={classes.userButton}>
        {user.displayName}
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
        {canCreatePassword && (
          <MenuItem
            onClick={() => {
              setMenuOpen(false);
              setCreatePasswordOpen(true);
            }}
          >
            <Typography variant="body1">Crear contraseña</Typography>
          </MenuItem>
        )}
        {profile?.role === 'teacher' && (
          <MenuItem
            onClick={() => {
              setMenuOpen(false);
              history.push('/history');
            }}
          >
            <Typography variant="body1">Historial de clases</Typography>
          </MenuItem>
        )}
        <MenuItem onClick={handleSignOut}>
          <Typography variant="body1">Cerrar sesión</Typography>
        </MenuItem>
      </Menu>
      <CreatePasswordDialog open={createPasswordOpen} onClose={() => setCreatePasswordOpen(false)} />
    </div>
  );
};

export default UserMenu;
