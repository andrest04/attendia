import React from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { NavLink, Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';

import S1Access from './screens/S1Access';
import S2WaitingRoom from './screens/S2WaitingRoom';
import S3StudentSession from './screens/S3StudentSession';
import S4ProfessorSession from './screens/S4ProfessorSession';
import S5ProctoringAlert from './screens/S5ProctoringAlert';
import S6AttentionReport from './screens/S6AttentionReport';
import S7Onboarding from './screens/S7Onboarding';
import S8Security from './screens/S8Security';
import { wf, GALLERY_NAV_HEIGHT } from './wireframe';

interface ScreenDef {
  path: string;
  label: string;
  Component?: React.ComponentType;
}

const screens: ScreenDef[] = [
  { path: 's1', label: 'S1 – Acceso', Component: S1Access },
  { path: 's2', label: 'S2 – Sala de espera', Component: S2WaitingRoom },
  { path: 's3', label: 'S3 – Sesión Estudiante', Component: S3StudentSession },
  { path: 's4', label: 'S4 – Sesión Docente', Component: S4ProfessorSession },
  { path: 's5', label: 'S5 – Alerta Proctoring', Component: S5ProctoringAlert },
  { path: 's6', label: 'S6 – Reporte Atención', Component: S6AttentionReport },
  { path: 's7', label: 'S7 – Onboarding', Component: S7Onboarding },
  { path: 's8', label: 'S8 – Seguridad y Privacidad', Component: S8Security },
];

const useStyles = makeStyles(() =>
  createStyles({
    page: { minHeight: '100vh', backgroundColor: wf.bg, display: 'flex', flexDirection: 'column' },
    nav: {
      backgroundColor: wf.white,
      borderBottom: `2px solid ${wf.gray300}`,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    },
    navInner: { display: 'flex', alignItems: 'center', overflowX: 'auto' },
    brand: {
      flexShrink: 0,
      padding: '6px 16px',
      borderRight: `1px solid ${wf.gray300}`,
    },
    brandMark: {
      width: 32,
      height: 32,
      backgroundColor: wf.gray700,
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 10,
      color: wf.white,
      fontWeight: 700,
    },
    tabs: { display: 'flex', overflowX: 'auto' },
    tab: {
      padding: '10px 14px',
      fontSize: 11,
      fontWeight: 400,
      color: wf.gray500,
      borderBottom: '2px solid transparent',
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      transition: 'all 0.15s',
      marginBottom: -2,
    },
    tabActive: {
      fontWeight: 600,
      color: wf.ink,
      borderBottom: `2px solid ${wf.gray700}`,
      backgroundColor: wf.bg,
    },
    wfBadge: { marginLeft: 'auto', padding: '0 16px', flexShrink: 0 },
    wfBadgeText: {
      fontSize: 9,
      color: wf.gray500,
      border: `1px solid ${wf.gray300}`,
      padding: '2px 6px',
      borderRadius: 3,
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    },
    main: { flex: 1 },

    placeholder: {
      minHeight: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      color: wf.gray500,
      textAlign: 'center',
      padding: 32,
    },
    placeholderTitle: { fontSize: 16, color: wf.gray700, fontWeight: 600 },
    placeholderText: { fontSize: 12, color: wf.gray500, maxWidth: 360 },
  })
);

function Placeholder({ label }: { label: string }) {
  const classes = useStyles();
  return (
    <div className={classes.placeholder}>
      <div className={classes.placeholderTitle}>{label}</div>
      <div className={classes.placeholderText}>
        Pantalla aún no portada. Validamos S1 primero y luego seguimos con el resto del wireframe.
      </div>
    </div>
  );
}

/**
 * Dev-only design gallery. Renders the ported wireframe screens (mock data, no
 * Twilio wiring) under `/design`, mirroring the tab navigation from the Figma
 * Make export. Mounted in `src/index.tsx` outside the PrivateRoute so the real
 * video flow is untouched.
 */
export default function DesignGallery() {
  const classes = useStyles();
  const { url } = useRouteMatch();
  const base = url.replace(/\/$/, '');

  return (
    <div className={classes.page}>
      <nav className={classes.nav}>
        <div className={classes.navInner}>
          <div className={classes.brand}>
            <div className={classes.brandMark}>P</div>
          </div>
          <div className={classes.tabs}>
            {screens.map(screen => (
              <NavLink
                key={screen.path}
                to={`${base}/${screen.path}`}
                className={classes.tab}
                activeClassName={classes.tabActive}
              >
                {screen.label}
              </NavLink>
            ))}
          </div>
          <div className={classes.wfBadge}>
            <span className={classes.wfBadgeText}>MID-FIDELITY WIREFRAME · GRAYSCALE</span>
          </div>
        </div>
      </nav>

      <main className={classes.main}>
        <Switch>
          {screens.map(screen => (
            <Route key={screen.path} path={`${base}/${screen.path}`}>
              {screen.Component ? <screen.Component /> : <Placeholder label={screen.label} />}
            </Route>
          ))}
          <Redirect to={`${base}/s1`} />
        </Switch>
      </main>
    </div>
  );
}
