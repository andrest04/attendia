import React from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core';

/**
 * Fixed rail widths of each desktop shell (px). `narrow*` apply on tight desktop widths
 * (below the `md` breakpoint) so the stage stays usable.
 */
const RAIL_WIDTHS = {
  professor: { left: 228, right: 280, narrowLeft: 200, narrowRight: 240 },
  student: { left: 236, right: 300, narrowLeft: 200, narrowRight: 264 },
};

export type RoomShellVariant = keyof typeof RAIL_WIDTHS;

type RailWidths = typeof RAIL_WIDTHS[RoomShellVariant];

// Column templates keyed by which rails are open. The grid ALWAYS keeps three tracks (a closed
// rail collapses to 0px instead of being removed) so the widths are interpolable — a changing
// track count would snap instead of transition.
const columnStates = (theme: Theme, w: RailWidths) => ({
  both: {
    gridTemplateColumns: `${w.left}px 1fr ${w.right}px`,
    [theme.breakpoints.down('md')]: { gridTemplateColumns: `${w.narrowLeft}px 1fr ${w.narrowRight}px` },
  },
  leftOnly: {
    gridTemplateColumns: `${w.left}px 1fr 0px`,
    [theme.breakpoints.down('md')]: { gridTemplateColumns: `${w.narrowLeft}px 1fr 0px` },
  },
  rightOnly: {
    gridTemplateColumns: `0px 1fr ${w.right}px`,
    [theme.breakpoints.down('md')]: { gridTemplateColumns: `0px 1fr ${w.narrowRight}px` },
  },
  none: { gridTemplateColumns: '0px 1fr 0px' },
});

const useStyles = makeStyles((theme: Theme) => {
  const professor = columnStates(theme, RAIL_WIDTHS.professor);
  const student = columnStates(theme, RAIL_WIDTHS.student);
  return createStyles({
    root: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      minHeight: 0,
      backgroundColor: theme.palette.background.default,
      position: 'relative',
    },
    // The rails + stage live in a grid that fills the height above the toolbar; the toolbar is a
    // full-width footer (sibling), so controls stay centered on screen regardless of which rails
    // are open (Meet-style). Rails collapse on entry.
    body: {
      flex: 1,
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: '1fr',
      overflow: 'hidden',
      // Smoothly animate the rails opening/closing.
      transition: 'grid-template-columns 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
      },
    },
    professorBoth: professor.both,
    professorLeftOnly: professor.leftOnly,
    professorRightOnly: professor.rightOnly,
    professorNone: professor.none,
    studentBoth: student.both,
    studentLeftOnly: student.leftOnly,
    studentRightOnly: student.rightOnly,
    studentNone: student.none,
    toolbar: {
      flexShrink: 0,
      backgroundColor: '#0f1e45',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: theme.spacing(1.25, 2),
    },
  });
});

interface RoomShellLayoutProps {
  variant: RoomShellVariant;
  /** `data-testid` prefix: the root is `${testIdPrefix}-root`, the footer `${testIdPrefix}-toolbar-slot`. */
  testIdPrefix: string;
  statusBar: React.ReactNode;
  leftRail: React.ReactNode;
  /** The center column (the stage and whatever overlays it). Owned by each shell. */
  center: React.ReactNode;
  rightRail: React.ReactNode;
  toolbar: React.ReactNode;
  leftOpen: boolean;
  rightOpen: boolean;
  /** Rendered after the footer, inside the root (modals, hidden test anchors). */
  children?: React.ReactNode;
}

/**
 * The scaffold both desktop room shells share (Template Method with slots): the status bar on
 * top, a three-column body (left rail · center · right rail) whose widths follow which rails are
 * open, and the full-width toolbar footer. Each shell fills the slots and keeps what is truly
 * its own — the rails' content, the stage overlays and the modals.
 */
export default function RoomShellLayout({
  variant,
  testIdPrefix,
  statusBar,
  leftRail,
  center,
  rightRail,
  toolbar,
  leftOpen,
  rightOpen,
  children,
}: RoomShellLayoutProps) {
  const classes = useStyles();
  const columns = {
    professor: {
      both: classes.professorBoth,
      leftOnly: classes.professorLeftOnly,
      rightOnly: classes.professorRightOnly,
      none: classes.professorNone,
    },
    student: {
      both: classes.studentBoth,
      leftOnly: classes.studentLeftOnly,
      rightOnly: classes.studentRightOnly,
      none: classes.studentNone,
    },
  }[variant];

  return (
    <section className={classes.root} data-testid={`${testIdPrefix}-root`}>
      {statusBar}
      <div
        className={clsx(classes.body, {
          [columns.both]: leftOpen && rightOpen,
          [columns.leftOnly]: leftOpen && !rightOpen,
          [columns.rightOnly]: !leftOpen && rightOpen,
          [columns.none]: !leftOpen && !rightOpen,
        })}
      >
        {leftRail}
        {center}
        {rightRail}
      </div>
      <div className={classes.toolbar} data-testid={`${testIdPrefix}-toolbar-slot`}>
        {toolbar}
      </div>
      {children}
    </section>
  );
}
