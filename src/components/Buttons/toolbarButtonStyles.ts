import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';

/**
 * Shared attendia toolbar-button style.
 *
 * Produces a vertical layout:
 *   - Circular outlined icon container (44 x 44 px) centred
 *   - Small label text (10 px, #64748b) below, centred
 *
 * The MUI Button label flex-direction is overridden to column so that the
 * existing startIcon + children text become top/bottom instead of left/right.
 *
 * Active state: blue-filled circle (#1d6eed), white icon, blue label.
 * Disabled state: muted icon and label (#94a3b8).
 */
export const useToolbarButtonStyles = makeStyles((theme: Theme) =>
  createStyles({
    // Applied to the MUI Button root
    toolbarButton: {
      // Kill horizontal padding — we want a tight vertical stack
      padding: '4px 8px',
      minWidth: 'unset',
      borderRadius: '4px',
      background: 'transparent',
      color: '#64748b',
      '&:hover': {
        background: 'rgba(29, 110, 237, 0.06)',
      },
      // Override the MUI internal .MuiButton-label flex-direction
      '& .MuiButton-label': {
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      },
      // The icon wrapper (startIcon) becomes a circular outlined container
      '& .MuiButton-startIcon': {
        margin: 0,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '1.5px solid #e2ecf9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        transition: theme.transitions.create(['background-color', 'border-color'], {
          duration: theme.transitions.duration.short,
        }),
        '& svg': {
          width: 20,
          height: 20,
          color: '#64748b',
          fill: '#64748b',
          transition: theme.transitions.create('color', { duration: theme.transitions.duration.short }),
        },
      },
      // Label text (children): small, centred
      '& .MuiButton-label > *:not(.MuiButton-startIcon)': {
        fontSize: '10px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        lineHeight: 1.2,
        color: '#64748b',
        whiteSpace: 'nowrap',
      },
      // Disabled state
      '&.Mui-disabled': {
        '& .MuiButton-startIcon': {
          borderColor: '#e2ecf9',
          backgroundColor: '#f8faff',
          '& svg': {
            color: '#94a3b8',
            fill: '#94a3b8',
          },
        },
        '& .MuiButton-label > *:not(.MuiButton-startIcon)': {
          color: '#94a3b8',
        },
      },
    },

    // Applied when the button is in its active/on state
    toolbarButtonActive: {
      '& .MuiButton-startIcon': {
        backgroundColor: '#1d6eed',
        borderColor: '#1d6eed',
        '& svg': {
          color: '#ffffff',
          fill: '#ffffff',
        },
      },
      '& .MuiButton-label > *:not(.MuiButton-startIcon)': {
        color: '#1d6eed',
        fontWeight: 600,
      },
    },

    // Applied instead of `toolbarButton`'s own circular icon container when the button
    // sits inside a dark, already-circular toolbar chip (ProfessorToolbar/StudentRoomToolbar) —
    // strips the inner white circle/border so the outer chip is the ONLY circle, and re-tints
    // the icon to match that chip's neutral/active palette (mirrors the plain chip buttons —
    // participants, chat, more — in the same toolbars). `!important` throughout: `toolbarButton`
    // and the toolbar's own chip classes come from two different makeStyles hooks, so which one
    // wins a same-specificity tie depends on module-load order — that was observed to flip
    // between the professor/student shells (identical markup, different result). `!important`
    // removes that non-determinism instead of hoping insertion order cooperates.
    chipIcon: {
      backgroundColor: 'rgba(255, 255, 255, 0.08) !important',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.14) !important',
      },
      '& .MuiButton-startIcon': {
        width: 'auto !important',
        height: 'auto !important',
        border: 'none !important',
        backgroundColor: 'transparent !important',
        '& svg': {
          width: 20,
          height: 20,
          color: 'rgba(255, 255, 255, 0.5) !important',
          fill: 'rgba(255, 255, 255, 0.5) !important',
        },
      },
      '&.Mui-disabled': {
        backgroundColor: 'rgba(255, 255, 255, 0.08) !important',
        '& .MuiButton-startIcon svg': {
          color: 'rgba(255, 255, 255, 0.25) !important',
          fill: 'rgba(255, 255, 255, 0.25) !important',
        },
      },
    },
    chipIconActive: {
      '& .MuiButton-startIcon svg': {
        color: '#1d6eed !important',
        fill: '#1d6eed !important',
      },
    },
  })
);

interface ToolbarButtonClassOptions {
  /** The control is on (mic live, camera on, hand raised, sharing). */
  active?: boolean;
  /** Bare icon inside an already-circular chip: no inner circle, the chip is the only shape. */
  plain?: boolean;
  /** The caller's own class, always last so it can override. */
  className?: string;
}

/**
 * Composes the class list every toolbar toggle puts on its root `<Button>`: the base look, the
 * plain-chip variant and the matching active tint. A function (not a wrapper component) on
 * purpose — the buttons keep rendering a plain MUI `<Button>` as their root element.
 */
export function toolbarButtonClass(
  classes: ReturnType<typeof useToolbarButtonStyles>,
  { active = false, plain = false, className }: ToolbarButtonClassOptions = {}
) {
  return clsx(
    classes.toolbarButton,
    plain && classes.chipIcon,
    {
      [classes.toolbarButtonActive]: !plain && active,
      [classes.chipIconActive]: plain && active,
    },
    className
  );
}
