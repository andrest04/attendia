import React from 'react';
import { makeStyles, Theme, Typography } from '@material-ui/core';
import { useAppState } from '../../state';
import UserMenu from './UserMenu/UserMenu';
import { useLocation } from 'react-router-dom';
import AttendiaLogo from '../Brand/AttendiaLogo';

const useStyles = makeStyles((theme: Theme) => ({
  // ── Full-page layout ─────────────────────────────────────────────────────────
  root: {
    minHeight: '100%',
    backgroundColor: '#f0f5ff',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    // Allow the page to scroll rather than clipping content. The header stays at
    // the top of the flex column so it is never pushed out of view by overflowing
    // content (e.g. the wider DeviceSelectionScreen card at the device-check step).
    overflow: 'auto',
  },

  // ── Decorative background circles ────────────────────────────────────────────
  bgCircle1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(29,110,237,0.07)',
    top: -80,
    left: -80,
    pointerEvents: 'none',
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
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottom: '1px solid #e2ecf9',
    padding: '14px 36px 15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    position: 'relative',
    zIndex: 10,
    [theme.breakpoints.down('sm')]: {
      padding: '12px 20px',
    },
  },
  logoMark: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
  },
  logoIcon: {
    width: 32,
    height: 32,
  },
  logoText: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 22,
    color: '#1d2f6f',
    letterSpacing: '-0.5px',
    lineHeight: 1,
  },
  headerChips: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    [theme.breakpoints.down('xs')]: {
      display: 'none',
    },
  },
  headerChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '10.5px 19.5px',
    border: '1.5px solid #e2ecf9',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    fontSize: 13,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    color: '#64748b',
    whiteSpace: 'nowrap',
  },
  headerChipIcon: {
    width: 14,
    height: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    flexShrink: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  userMenuWrapper: {
    marginLeft: 8,
  },

  // ── Main content area ────────────────────────────────────────────────────────
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '0 32px 40px',
    position: 'relative',
    zIndex: 1,
    [theme.breakpoints.down('sm')]: {
      padding: '0 16px 24px',
    },
  },

  // ── Hero section (pill badge + H1 + subtitle) ────────────────────────────────
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 40,
    width: '100%',
  },
  heroBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e3edfb',
    border: '1px solid rgba(29,110,237,0.18)',
    borderRadius: 20,
    padding: '7px 17px',
    marginBottom: 16,
  },
  heroBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#1d6eed',
    flexShrink: 0,
  },
  heroBadgeText: {
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
    fontSize: 36,
    color: '#1d2f6f',
    letterSpacing: '-1.08px',
    lineHeight: '45px',
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
    marginTop: 11,
  },

  // ── Content card wrapper ──────────────────────────────────────────────────────
  contentCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    width: '100%',
    maxWidth: 520,
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
    padding: '17px 36px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    position: 'relative',
    zIndex: 10,
    [theme.breakpoints.down('sm')]: {
      padding: '12px 20px',
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

// Simple SVG lock icon
function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="6" width="9" height="6.5" rx="1.5" stroke="#64748b" strokeWidth="1.3" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// Simple SVG monitor icon
function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1.5" width="12" height="8.5" rx="1.5" stroke="#64748b" strokeWidth="1.3" />
      <path d="M5 12.5h4M7 10v2.5" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface IntroContainerProps {
  children: React.ReactNode;
  // When true, suppresses the hero section (used for device-check step and other inner screens).
  noHero?: boolean;
  // Width of the content card. Defaults to 520 (narrow form); device-check passes a wider value.
  maxWidth?: number;
}

const IntroContainer = (props: IntroContainerProps) => {
  const classes = useStyles();
  const { user } = useAppState();
  const location = useLocation();
  const rootRef = React.useRef<HTMLDivElement>(null);

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
    <div className={classes.root} ref={rootRef}>
      {/* Decorative background blobs */}
      <div className={classes.bgCircle1} aria-hidden="true" />
      <div className={classes.bgCircle2} aria-hidden="true" />
      <div className={classes.bgCircle3} aria-hidden="true" />
      <div className={classes.bgCircle4} aria-hidden="true" />

      {/* Header */}
      <div className={classes.header}>
        {/* attendia logo */}
        <div className={classes.logoMark}>
          <AttendiaLogo variant="full" size={32} />
        </div>

        <div className={classes.headerRight}>
          {/* Header info chips */}
          <div className={classes.headerChips}>
            <div className={classes.headerChip}>
              <span className={classes.headerChipIcon}>
                <LockIcon />
              </span>
              Acceso seguro por token
            </div>
            <div className={classes.headerChip}>
              <span className={classes.headerChipIcon}>
                <MonitorIcon />
              </span>
              Usar desde navegador
            </div>
          </div>

          {user && location.pathname !== '/login' && (
            <div className={classes.userMenuWrapper}>
              <UserMenu />
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className={classes.main}>
        {!props.noHero && (
          <div className={classes.hero}>
            <div className={classes.heroBadge}>
              <div className={classes.heroBadgeDot} />
              <span className={classes.heroBadgeText}>Plataforma de Videoconferencia con IA</span>
            </div>
            <Typography component="h1" className={classes.heroTitle}>
              Bienvenido a <span className={classes.heroTitleAccent}>attendia</span>
            </Typography>
            <p className={classes.heroSubtitle}>
              Videoconferencia síncrona para aulas híbridas con detección de atención en tiempo real.
            </p>
          </div>
        )}

        <div className={classes.contentCard} style={props.maxWidth ? { maxWidth: props.maxWidth } : undefined}>
          {props.children}
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
            Política de privacidad de datos faciales
          </a>
          <a href="/security" className={classes.footerLink}>
            Seguridad y cifrado
          </a>
        </div>
      </div>
    </div>
  );
};

export default IntroContainer;
