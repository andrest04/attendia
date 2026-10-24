import React from 'react';
import clsx from 'clsx';
import { Button, createStyles, makeStyles } from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { t } from '../../../i18n/translate';

// Hand-rolled (not MUI Menu) to stay portal-free and trivially testable, mirroring the roster
// moderation kebab in ProfessorRoomShell.
const useStyles = makeStyles(() =>
  createStyles({
    moreWrap: {
      position: 'relative',
      display: 'flex',
    },
    moreMenuBackdrop: {
      position: 'fixed',
      inset: 0,
      zIndex: 15,
    },
    // Entry animation: fade + subtle rise/scale from the bottom-right corner (where the kebab
    // sits), so opening feels smooth, not abrupt.
    '@keyframes moreMenuIn': {
      from: {
        opacity: 0,
        transform: 'translateY(6px) scale(0.96)',
      },
      to: {
        opacity: 1,
        transform: 'translateY(0) scale(1)',
      },
    },
    moreMenu: {
      position: 'absolute',
      // Toolbar sits at the bottom of the stage, so the menu opens upward.
      bottom: '100%',
      right: 0,
      marginBottom: 8,
      zIndex: 16,
      minWidth: 210,
      backgroundColor: '#16255c',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      padding: '6px 0',
      transformOrigin: 'bottom right',
      animation: '$moreMenuIn 150ms cubic-bezier(0.2, 0, 0.15, 1)',
      // Respect users who ask the OS to minimize motion.
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
      },
    },
    moreMenuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '10px 14px',
      background: 'none',
      border: 'none',
      textAlign: 'left' as const,
      cursor: 'pointer',
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.85)',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.08)',
      },
      '&:disabled': {
        opacity: 0.5,
        cursor: 'default',
      },
    },
    // Active tints for stateful items.
    toneAccent: {
      color: '#69a9ff',
    },
    toneRecording: {
      color: '#ef4444',
    },
    moreMenuDivider: {
      height: 1,
      margin: '6px 0',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
  })
);

export interface OverflowMenuItem {
  /** Full `data-testid` of the item button. */
  testId: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  /** Stateful item (a switch): rendered as a `menuitemcheckbox`, tinted by `tone` while on. */
  checked?: boolean;
  /** Tint applied while `checked`. */
  tone?: 'accent' | 'recording';
  disabled?: boolean;
  /** Items the current context does not offer are dropped (no empty slot, no stray divider). */
  hidden?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  /** The kebab is `${testIdPrefix}-more`, the open menu `${testIdPrefix}-more-menu`. */
  testIdPrefix: string;
  /** The circular chip class the host toolbar gives every control, so the kebab matches. */
  chipClassName: string;
}

/**
 * The toolbar's "more options" kebab: secondary controls live behind it so the primary bar stays
 * lean. It owns the open state, and choosing an item always closes the menu after running it.
 * Both room toolbars used to hand-roll this markup; they now only declare their items.
 */
export default function OverflowMenu({ items, testIdPrefix, chipClassName }: OverflowMenuProps) {
  const classes = useStyles();
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => setIsOpen(false);
  const visibleItems = items.filter(item => !item.hidden);

  return (
    <div className={classes.moreWrap}>
      <Button
        onClick={() => setIsOpen(open => !open)}
        startIcon={<MoreVertIcon style={{ color: isOpen ? '#1d6eed' : 'rgba(255,255,255,0.5)' }} />}
        className={chipClassName}
        aria-label={t('Más')}
        data-testid={`${testIdPrefix}-more`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      />
      {isOpen && (
        <>
          <div className={classes.moreMenuBackdrop} onClick={close} />
          <div className={classes.moreMenu} data-testid={`${testIdPrefix}-more-menu`} role="menu">
            {visibleItems.map((item, index) => (
              <React.Fragment key={item.testId}>
                {index > 0 && <div className={classes.moreMenuDivider} />}
                <button
                  type="button"
                  className={clsx(classes.moreMenuItem, {
                    [item.tone === 'recording' ? classes.toneRecording : classes.toneAccent]: item.checked,
                  })}
                  data-testid={item.testId}
                  role="menuitemcheckbox"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect();
                    close();
                  }}
                  aria-checked={Boolean(item.checked)}
                >
                  {item.icon}
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
