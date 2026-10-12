import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles(() => ({
  rail: {
    // Fade + micro-scale the content in as the column widens. The grid handles the spatial reveal;
    // this GPU-cheap fade hides the frame-by-frame reflow so opening reads smooth, not a hard clip.
    transition: 'opacity 0.24s ease, transform 0.24s ease, border-color 0.2s linear',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  // The seam border lives here (not in the rail's own class) so `railCollapsed` below can
  // reliably override its color: both rules are in one sheet, so source order decides.
  seamLeft: { borderLeft: '1px solid #e2ecf9' },
  seamRight: { borderRight: '1px solid #e2ecf9' },
  // A rail whose column has collapsed to 0px: drop the seam border, fade out the content, and
  // block interaction with the clipped content while it is hidden.
  railCollapsed: {
    borderColor: 'transparent',
    opacity: 0,
    transform: 'scale(0.98)',
    pointerEvents: 'none',
  },
  close: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 18,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    '&:hover': { color: '#1d2f6f', backgroundColor: '#f0f5ff' },
  },
}));

interface CollapsibleRailProps {
  /** Which side of the stage the rail sits on: the seam border faces the stage. */
  side: 'left' | 'right';
  open: boolean;
  /** The rail's own look (background, layout, overflow). */
  className?: string;
  'data-testid': string;
  children: React.ReactNode;
}

/**
 * A side rail that stays mounted when closed (its grid column collapses to 0px) so it can animate
 * open/closed. Closed rails fade out, lose their seam border and are hidden from assistive tech.
 * Shared by all four rails of the two desktop shells.
 */
export function CollapsibleRail({ side, open, className, children, ...rest }: CollapsibleRailProps) {
  const classes = useStyles();
  return (
    <aside
      className={clsx(
        classes.rail,
        side === 'left' ? classes.seamRight : classes.seamLeft,
        { [classes.railCollapsed]: !open },
        className
      )}
      data-testid={rest['data-testid']}
      aria-hidden={!open}
    >
      {children}
    </aside>
  );
}

interface RailCloseButtonProps {
  onClick: () => void;
  'aria-label': string;
  'data-testid': string;
}

/** The × affordance in a rail's header that dismisses it. */
export function RailCloseButton({ onClick, ...rest }: RailCloseButtonProps) {
  const classes = useStyles();
  return (
    <button
      type="button"
      className={classes.close}
      onClick={onClick}
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid']}
    >
      ×
    </button>
  );
}
