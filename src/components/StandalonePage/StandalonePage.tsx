import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';

import AttendiaLogo from '../Brand/AttendiaLogo';

/*
 * The chrome the standalone light pages share (report, recording and document viewers, class
 * history): a #f0f5ff page, a white top bar with the logo, and the blue text buttons that live
 * in it. Each page used to copy the same ~70 lines of styles. It is a layout component, not a
 * HOC: the page keeps full control of its body and of its own data loading.
 */

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    backgroundColor: '#f0f5ff',
    minHeight: '100vh',
  },
  // Viewer pages: the body fills exactly the viewport below the bar.
  fill: {
    height: '100vh',
    minHeight: 'unset',
    display: 'flex',
    flexDirection: 'column',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2, 3),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2ecf9',
    flexShrink: 0,
  },
  navDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2ecf9',
  },
  // Right-aligned actions, even when the title is short or absent.
  navEnd: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexShrink: 0,
  },
  titleMuted: {
    color: '#64748b',
  },
  titleStrong: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    color: '#0f172a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 8,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    color: '#1d6eed',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: '#ebf3ff',
    },
    '&:disabled': { cursor: 'default', opacity: 0.6 },
  },
  navButtonOutlined: {
    border: '1px solid #e2ecf9',
    color: '#0f172a',
  },
  messageCard: {
    margin: '15vh auto 0',
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    padding: theme.spacing(6, 4),
    textAlign: 'center',
  },
  messageText: {
    fontSize: '0.9375rem',
    color: '#64748b',
    lineHeight: 1.6,
  },
}));

interface StandalonePageProps {
  /** `data-testid` of the page root. */
  testId: string;
  /** Make the page exactly one viewport tall (viewers) instead of at least one (documents). */
  fill?: boolean;
  /** Left side of the bar, after the logo: the page title or a back button. */
  navStart?: React.ReactNode;
  /** Right side of the bar: download, close... */
  navEnd?: React.ReactNode;
  children: React.ReactNode;
}

export default function StandalonePage({ testId, fill, navStart, navEnd, children }: StandalonePageProps) {
  const classes = useStyles();
  return (
    <div className={clsx(classes.root, { [classes.fill]: fill })} data-testid={testId}>
      <nav className={classes.nav}>
        <AttendiaLogo variant="full" size={28} />
        <div className={classes.navDivider} />
        {navStart}
        {navEnd && <div className={classes.navEnd}>{navEnd}</div>}
      </nav>
      {children}
    </div>
  );
}

/** The page title in the bar: `strong` for the name of what is being viewed, `muted` for a label. */
export function PageTitle({ tone, children }: { tone: 'muted' | 'strong'; children: React.ReactNode }) {
  const classes = useStyles();
  return (
    <Typography variant="body2" className={tone === 'strong' ? classes.titleStrong : classes.titleMuted}>
      {children}
    </Typography>
  );
}

interface PageNavButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  testId: string;
  variant?: 'text' | 'outlined';
  disabled?: boolean;
}

/** A button of the top bar (close, back, download). */
export function PageNavButton({ onClick, icon, children, testId, variant = 'text', disabled }: PageNavButtonProps) {
  const classes = useStyles();
  return (
    <button
      type="button"
      className={clsx(classes.navButton, { [classes.navButtonOutlined]: variant === 'outlined' })}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {icon}
      {children}
    </button>
  );
}

/** The centered card a page shows instead of its content while loading, or when loading failed. */
export function PageMessageCard({
  testId,
  maxWidth = 480,
  children,
}: {
  testId: string;
  maxWidth?: number;
  children: React.ReactNode;
}) {
  const classes = useStyles();
  return (
    <div className={classes.messageCard} style={{ maxWidth }} data-testid={testId}>
      <Typography className={classes.messageText}>{children}</Typography>
    </div>
  );
}

/** Message text in the page's muted body style, for notes that sit outside a card. */
export function PageNote({ testId, children }: { testId: string; children: React.ReactNode }) {
  const classes = useStyles();
  return (
    <Typography className={classes.messageText} data-testid={testId}>
      {children}
    </Typography>
  );
}
