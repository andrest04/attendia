import React, { useState } from 'react';
import { makeStyles, MenuItem, Theme, Typography } from '@material-ui/core';
import { useAppState } from '../../state';
import DashboardHeader from '../TeacherDashboard/DashboardHeader';
import CreatePasswordDialog from './CreatePasswordDialog/CreatePasswordDialog';
import { useHistory, useLocation } from 'react-router-dom';
import AttendiaLogo from '../Brand/AttendiaLogo';
import { getProfessorInitials } from '../../utils/professorIdentity/professorIdentity';

const useStyles = makeStyles((theme: Theme) => ({
  // ── Full-page layout ─────────────────────────────────────────────────────────
  root: {
    minHeight: '100%',
    backgroundColor: '#f0f5ff',
    // Role tint (blue <-> amber) animates instead of snapping when the user
    // switches role cards on the login/lobby screens.
    transition: 'background-color 0.5s ease',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    // Allow the page to scroll rather than clipping content. The header stays at
    // the top of the flex column so it is never pushed out of view by overflowing
    // content (e.g. the wider DeviceSelectionScreen card at the device-check step).
    overflow: 'auto',
  },

  // ── Decorative background circles ────────────────────────────────────────────
  // The circles intentionally poke outside the page edges (negative offsets). This
  // wrapper clips them so they never extend the scrollable area — without it,
  // bgCircle4 (bottom: -40) adds 40px of phantom vertical scroll.
  bgDecor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  bgCircle1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(29,110,237,0.07)',
    top: -80,
    left: -80,
    pointerEvents: 'none',
    transition: 'background 0.5s ease',
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'rgba(29,110,237,0.05)',
    top: 60,
    right: -40,
    pointerEvents: 'none',
    transition: 'background 0.5s ease',
  },
  bgCircle3: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: '50%',
    background: 'rgba(255,184,0,0.06)',
    bottom: 60,
    right: 80,
    pointerEvents: 'none',
    transition: 'background 0.5s ease',
  },
  bgCircle4: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: '50%',
    background: 'rgba(29,110,237,0.05)',
    bottom: -40,
    left: 120,
    pointerEvents: 'none',
    transition: 'background 0.5s ease',
  },

  // ── Student (warm) page variant ──────────────────────────────────────────────
  // The lobby is tinted by role: teacher keeps the default blue palette; the
  // student flow swaps the page background and decorative circles to amber so the
  // two entry points read differently at a glance. In-room UI is not affected.
  // These overrides are defined after the base classes so they win in JSS order.
  rootStudent: {
    backgroundColor: '#fffaec',
  },
  bgCircle1Student: {
    background: 'rgba(255,184,0,0.10)',
  },
  bgCircle2Student: {
    background: 'rgba(255,184,0,0.06)',
  },
  bgCircle3Student: {
    background: 'rgba(29,110,237,0.05)',
  },
  bgCircle4Student: {
    background: 'rgba(255,184,0,0.07)',
  },
  heroBadgeStudent: {
    backgroundColor: '#fdf3d7',
    border: '1px solid rgba(217,119,6,0.25)',
  },
  heroBadgeDotStudent: {
    backgroundColor: '#d97706',
  },
  heroBadgeTextStudent: {
    color: '#b45309',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  // "Pre-sesión" pill shown instead of the info chips on the device-check step
  presessionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 18px',
    borderRadius: 999,
    backgroundColor: '#e3edff',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    color: '#1d6eed',
    whiteSpace: 'nowrap',
  },
  presessionDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#1d6eed',
    flexShrink: 0,
  },

  // ── Main content area ────────────────────────────────────────────────────────
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '0 32px clamp(8px, 1.3vh, 20px)',
    position: 'relative',
    zIndex: 1,
    [theme.breakpoints.down('sm')]: {
      padding: '0 16px clamp(8px, 1.7vh, 20px)',
    },
  },
  // Without the hero there is nothing between the header and the content card,
  // so give the card a little fluid breathing room (device-check step).
  mainNoHero: {
    paddingTop: 'clamp(8px, 1.4vh, 18px)',
  },

  // ── Hero section (pill badge + H1 + subtitle) ────────────────────────────────
  // Vertical spacing is fluid (clamp + vh): it compresses continuously with the
  // viewport height. Nothing in the hero is hidden on short viewports — when the
  // content cannot fit (e.g. a zoomed-in browser) the page scrolls (root is
  // overflow:auto) rather than dropping the logo, badge or subtitle.
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 'clamp(8px, 1.6vh, 18px)',
    paddingBottom: 'clamp(8px, 2vh, 24px)',
    width: '100%',
  },
  // Standalone isotype (logo only — no wordmark) shown above the welcome badge.
  heroLogo: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 'clamp(4px, 0.9vh, 10px)',
  },
  heroBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e3edfb',
    border: '1px solid rgba(29,110,237,0.18)',
    borderRadius: 20,
    padding: '7px 17px',
    marginBottom: 'clamp(6px, 1.2vh, 14px)',
    transition: 'background-color 0.5s ease, border-color 0.5s ease',
  },
  heroBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#1d6eed',
    flexShrink: 0,
    transition: 'background-color 0.5s ease',
  },
  heroBadgeText: {
    transition: 'color 0.5s ease',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#1d6eed',
    lineHeight: '18px',
    whiteSpace: 'nowrap',
  },
  heroTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 800,
    fontSize: 'clamp(26px, 4.5vh, 36px)',
    color: '#1d2f6f',
    letterSpacing: '-1.08px',
    lineHeight: 1.25,
    textAlign: 'center',
    marginBottom: 0,
  },
  heroTitleAccent: {
    color: '#1d6eed',
  },
  heroSubtitle: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 15,
    color: '#64748b',
    lineHeight: '22.5px',
    textAlign: 'center',
    maxWidth: 520,
    marginTop: 'clamp(4px, 0.8vh, 10px)',
  },

  // ── Content column (back link + card, sharing one max width) ────────────────
  contentColumn: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: 520,
    gap: 10,
  },
  // Back-to-dashboard link (teacher only): rendered ABOVE contentCard, as its own
  // row, so it reads as page-level navigation rather than part of the white card.
  backToDashboardLink: {
    alignSelf: 'flex-start',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    fontSize: 13,
    color: '#64748b',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    lineHeight: '19.5px',
    '&:hover': {
      color: '#1d6eed',
      textDecoration: 'underline',
    },
  },

  // ── Content card wrapper ──────────────────────────────────────────────────────
  contentCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    width: '100%',
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    [theme.breakpoints.down('sm')]: {
      borderRadius: 12,
    },
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    borderTop: '1px solid #e2ecf9',
    backgroundColor: 'rgba(255,255,255,0.70)',
    padding: 'clamp(7px, 1.3vh, 14px) 36px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    position: 'relative',
    zIndex: 10,
    [theme.breakpoints.down('sm')]: {
      padding: 'clamp(7px, 1.3vh, 12px) 20px',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
  },
  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#10b981',
    flexShrink: 0,
  },
  footerText: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: '18px',
  },
  footerTextStrong: {
    fontWeight: 700,
    color: '#64748b',
  },
  footerLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  footerLink: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    fontSize: 12,
    color: '#1d6eed',
    textDecoration: 'none',
    lineHeight: '18px',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));

interface IntroContainerProps {
  children: React.ReactNode;
  // When true, suppresses the hero section (used for device-check step and other inner screens).
  noHero?: boolean;
  // Width of the content card. Defaults to 520 (narrow form); device-check passes a wider value.
  maxWidth?: number;
  // Pre-session header variant: shows "Clase: <name>" centered and a "Pre-sesión"
  // pill instead of the info chips (Figma waiting-room header).
  headerRoomName?: string;
  // Role carried when the header logo is clicked to go "home" (the lobby). Sent as
  // location.state.preJoinRole so the lobby reopens on the right role card. Role is a
  // client-set value (no server field), so it must travel with the navigation.
  homeRole?: 'teacher' | 'student';
  // When set (teacher only), renders a "Volver al panel" link above the content card
  // that abandons the prejoin flow and returns to the TeacherDashboard.
  onReturnToDashboard?: () => void;
  // Optional pre-navigation cleanup supplied by a parent that owns local media.
  onProfileClick?: () => void;
}

const IntroContainer = (props: IntroContainerProps) => {
  const classes = useStyles();
  const { user, profile, signOut } = useAppState();
  const location = useLocation();
  const history = useHistory();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const isStudent = props.homeRole === 'student';
  const [createPasswordOpen, setCreatePasswordOpen] = useState(false);

  // The header logo doubles as a "go home" control: it returns to the lobby (root) for the
  // current role. Navigating to '/' remounts PreJoinScreens at the room-name step, and the
  // role is preserved via location.state (mirrors how LoginPage seeds the role).
  const goHome = () => {
    history.push({ pathname: '/', state: props.homeRole ? { preJoinRole: props.homeRole } : undefined });
  };

  const openProfile = () => {
    props.onProfileClick?.();
    history.push('/profile');
  };

  const professorName = profile?.displayName || user?.displayName || undefined;
  const professorInitials = professorName ? getProfessorInitials(professorName) : undefined;
  const professorPhotoURL = profile?.avatarUrl || user?.photoURL || undefined;

  // Hidden when "Volver al panel" is showing (roomNameStep reached from the TeacherDashboard):
  // that link is already the way back, so the account menu here would be redundant.
  const showProfile = Boolean(user && location.pathname !== '/login' && !props.onReturnToDashboard);

  // Guard defensively because test mocks may not carry email/providerData.
  const firebaseUser = user as { email?: string | null; providerData?: ({ providerId: string } | null)[] } | null;
  const hasPasswordProvider = Boolean(firebaseUser?.providerData?.some(p => p?.providerId === 'password'));
  const canCreatePassword = Boolean(firebaseUser?.email) && !hasPasswordProvider;

  // The root container scrolls (overflow: auto) and keeps its scroll position when the
  // prejoin flow swaps steps inside it (lobby -> device check), leaving the header
  // clipped out of view. Reset scroll whenever the rendered step shape changes.
  React.useEffect(() => {
    if (rootRef.current) {
      rootRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [props.noHero, location.pathname]);

  return (
    <div className={`${classes.root}${isStudent ? ` ${classes.rootStudent}` : ''}`} ref={rootRef}>
      {/* Decorative background blobs (clipped so they never create scroll) */}
      <div className={classes.bgDecor} aria-hidden="true">
        <div className={`${classes.bgCircle1}${isStudent ? ` ${classes.bgCircle1Student}` : ''}`} />
        <div className={`${classes.bgCircle2}${isStudent ? ` ${classes.bgCircle2Student}` : ''}`} />
        <div className={`${classes.bgCircle3}${isStudent ? ` ${classes.bgCircle3Student}` : ''}`} />
        <div className={`${classes.bgCircle4}${isStudent ? ` ${classes.bgCircle4Student}` : ''}`} />
      </div>

      {/* Header — shared with Panel Docente so the profile chip looks identical everywhere */}
      <DashboardHeader
        professorName={professorName}
        professorInitials={professorInitials}
        professorPhotoURL={professorPhotoURL}
        identityColor={isStudent ? 'student' : 'teacher'}
        onLogoClick={goHome}
        showProfile={showProfile}
        showNotifications={false}
        showProfileLink={isStudent && showProfile}
        onProfileClick={openProfile}
        centerLabel={
          props.headerRoomName ? (
            <>
              Clase: <strong>{props.headerRoomName}</strong>
            </>
          ) : undefined
        }
        badge={
          props.headerRoomName ? (
            <span className={classes.presessionPill}>
              <span className={classes.presessionDot} />
              Pre-sesión
            </span>
          ) : undefined
        }
        extraMenuItems={
          showProfile ? (
            <>
              {canCreatePassword && (
                <MenuItem
                  onClick={() => {
                    setCreatePasswordOpen(true);
                  }}
                >
                  Crear contraseña
                </MenuItem>
              )}
              {isStudent && (
                <MenuItem onClick={() => signOut?.()} data-testid="student-header-sign-out">
                  Cerrar sesión
                </MenuItem>
              )}
            </>
          ) : undefined
        }
      />
      <CreatePasswordDialog open={createPasswordOpen} onClose={() => setCreatePasswordOpen(false)} />

      {/* Main content */}
      <div className={`${classes.main}${props.noHero ? ` ${classes.mainNoHero}` : ''}`}>
        {!props.noHero && (
          <div className={classes.hero}>
            <div className={classes.heroLogo}>
              <AttendiaLogo variant="icon" size={46} />
            </div>
            <div className={`${classes.heroBadge}${isStudent ? ` ${classes.heroBadgeStudent}` : ''}`}>
              <div className={`${classes.heroBadgeDot}${isStudent ? ` ${classes.heroBadgeDotStudent}` : ''}`} />
              <span className={`${classes.heroBadgeText}${isStudent ? ` ${classes.heroBadgeTextStudent}` : ''}`}>
                Plataforma de Videoconferencia
              </span>
            </div>
            <Typography component="h1" className={classes.heroTitle}>
              Bienvenido a <span className={classes.heroTitleAccent}>attendia</span>
            </Typography>
            <p className={classes.heroSubtitle}>
              Videoconferencia síncrona para aulas híbridas con detección de atención en tiempo real.
            </p>
          </div>
        )}

        <div className={classes.contentColumn} style={props.maxWidth ? { maxWidth: props.maxWidth } : undefined}>
          {props.onReturnToDashboard && (
            <button
              type="button"
              className={classes.backToDashboardLink}
              onClick={props.onReturnToDashboard}
              data-testid="back-to-dashboard"
            >
              ← Volver al panel
            </button>
          )}
          <div className={classes.contentCard}>{props.children}</div>
        </div>
      </div>

      {/* Footer */}
      <div className={classes.footer}>
        <div className={classes.footerLeft}>
          <div className={classes.footerDot} />
          <span className={classes.footerText}>
            Infraestructura: <strong className={classes.footerTextStrong}>Twilio Video WebRTC SFU</strong>
          </span>
        </div>
        <div className={classes.footerLinks}>
          <a href="/security" className={classes.footerLink}>
            Seguridad y Privacidad
          </a>
        </div>
      </div>
    </div>
  );
};

export default IntroContainer;
