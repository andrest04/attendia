import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import { DashboardTabId } from './types';
import { dashboardTabIcon, dashboardTabLabel } from './dashboardHelpers';
import { t } from '../../i18n/translate';

const useStyles = makeStyles((theme: Theme) => ({
  // This theme's `sm` boundary is 960px. A fixed rail leaves too little room for
  // dashboard cards and forms below it, so switch to a compact top navigation.
  root: {
    width: 240,
    boxSizing: 'border-box',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    borderRight: '1px solid #e2ecf9',
    padding: theme.spacing(3, 2),
    [theme.breakpoints.down('sm')]: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      borderRight: 'none',
      borderBottom: '1px solid #e2ecf9',
      padding: theme.spacing(1, 1.5),
      gap: theme.spacing(1),
      // The dashboard body scrolls as a whole here, so keep the strip (and its start/sign-out
      // buttons) pinned to the top instead of letting it scroll away with a long tab.
      position: 'sticky',
      top: 0,
      zIndex: 1,
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
      minWidth: 0,
      overflowX: 'auto',
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
  activeTab?: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
  onStartBlankClass: () => void;
  onSignOut?: () => void;
}

/** Left navigation rail shared by every Panel Docente tab. */
export default function DashboardSidebar({ activeTab, onTabChange, onStartBlankClass, onSignOut }: Props) {
  const classes = useStyles();

  return (
    <nav className={classes.root} data-testid="dashboard-sidebar">
      <span className={classes.sectionLabel}>{t('PANEL DOCENTE')}</span>
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
              {t(dashboardTabLabel[tab])}
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
          {t('Iniciar clase')}
        </button>
        <button
          type="button"
          className={classes.signOutLink}
          onClick={onSignOut}
          disabled={!onSignOut}
          title={onSignOut ? undefined : t('Cerrar sesión no está disponible en este modo')}
          data-testid="dashboard-sidebar-sign-out"
        >
          <ExitToAppIcon style={{ fontSize: 16 }} />
          {t('Cerrar sesión')}
        </button>
      </div>
    </nav>
  );
}
