import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import { DashboardTabId } from './types';
import { dashboardTabIcon, dashboardTabLabel } from './dashboardHelpers';

const useStyles = makeStyles((theme: Theme) => ({
  // Below 'md' (960px) this still is the desktop rail — just narrower, mirroring the
  // ProfessorRoomShell/StudentRoomShell "narrow desktop" tier. Below 'sm' (600px, the app's
  // actual mobile switch — see Room.tsx's isMobile) it flips to a horizontal top strip
  // instead: a fixed 240px left rail has no room on a phone-width viewport.
  root: {
    width: 240,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    borderRight: '1px solid #e2ecf9',
    padding: theme.spacing(3, 2),
    [theme.breakpoints.down('md')]: {
      width: 200,
    },
    [theme.breakpoints.down('sm')]: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      borderRight: 'none',
      borderBottom: '1px solid #e2ecf9',
      padding: theme.spacing(1, 1.5),
      gap: theme.spacing(1),
    },
  },
  sectionLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: theme.palette.text.secondary,
    padding: theme.spacing(0, 1.5, 1.5),
    // No room for this label once the rail becomes a horizontal strip; the active tab's own
    // highlight + icon already communicate context without it.
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    flex: 1,
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'row',
      flex: 'unset',
      overflowX: 'auto',
      width: '100%',
    },
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    '&:hover': {
      backgroundColor: '#f0f5ff',
    },
    [theme.breakpoints.down('sm')]: {
      flexShrink: 0,
      gap: theme.spacing(1),
      padding: theme.spacing(1, 1.25),
      fontSize: '0.8125rem',
    },
  },
  navItemActive: {
    backgroundColor: '#ebf3ff',
    color: theme.palette.primary.main,
    fontWeight: 700,
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'row',
      marginTop: 0,
      marginLeft: 'auto',
      flexShrink: 0,
    },
  },
  startButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  signOutLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: theme.palette.text.secondary,
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    fontWeight: 500,
    '&:hover': {
      color: theme.palette.text.primary,
    },
    '&:disabled': {
      cursor: 'default',
      opacity: 0.5,
      '&:hover': {
        color: theme.palette.text.secondary,
      },
    },
  },
}));

const TABS: DashboardTabId[] = ['clases', 'historial', 'recursos', 'calendario'];

interface Props {
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
  onStartBlankClass: () => void;
  onSignOut?: () => void;
}

/** Left navigation rail shared by every Panel Docente tab. */
export default function DashboardSidebar({ activeTab, onTabChange, onStartBlankClass, onSignOut }: Props) {
  const classes = useStyles();

  return (
    <nav className={classes.root} data-testid="dashboard-sidebar">
      <span className={classes.sectionLabel}>PANEL DOCENTE</span>
      <div className={classes.nav}>
        {TABS.map(tab => {
          const Icon = dashboardTabIcon[tab];
          return (
            <button
              key={tab}
              type="button"
              className={clsx(classes.navItem, { [classes.navItemActive]: activeTab === tab })}
              onClick={() => onTabChange(tab)}
              data-testid={`dashboard-sidebar-tab-${tab}`}
            >
              <Icon style={{ fontSize: 20 }} />
              {dashboardTabLabel[tab]}
            </button>
          );
        })}
      </div>
      <div className={classes.footer}>
        <button
          type="button"
          className={classes.startButton}
          onClick={onStartBlankClass}
          data-testid="dashboard-sidebar-start-class"
        >
          <PlayArrowIcon style={{ fontSize: 18 }} />
          Iniciar clase
        </button>
        <button
          type="button"
          className={classes.signOutLink}
          onClick={onSignOut}
          disabled={!onSignOut}
          title={onSignOut ? undefined : 'Cerrar sesión no está disponible en este modo'}
          data-testid="dashboard-sidebar-sign-out"
        >
          <ExitToAppIcon style={{ fontSize: 16 }} />
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
