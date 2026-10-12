import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    controlsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      // stretch (not center) so every chip matches the tallest one's height — the round
      // icon buttons are taller than the text chips, so centering left them uneven.
      alignItems: 'stretch',
      justifyContent: 'center',
      gap: theme.spacing(1),
      width: '100%',
    },
    // Circular icon-only chip — Google Meet-style: one uniform circle per control, icon
    // centred, no separate inner shape. `endCallChip` below widens this into a pill.
    chipLayout: {
      width: 44,
      height: 44,
      minWidth: 44,
      padding: 0,
      borderRadius: '50%',
      flexShrink: 0,
      '& .MuiButton-label': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      '& .MuiButton-startIcon': {
        margin: 0,
      },
      '& svg': {
        width: 20,
        height: 20,
      },
    },
    chipDark: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.8)',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.14)',
      },
    },
    // Widens the circular chip into a pill for the leave control.
    endCallChip: {
      width: 'auto',
      minWidth: 110,
      padding: '0 20px',
      borderRadius: 22,
      backgroundColor: '#1d2f6f',
      color: '#ffffff',
      '&:hover': {
        backgroundColor: '#152356',
      },
    },
    divider: {
      width: 1,
      alignSelf: 'stretch',
      margin: theme.spacing(0.5),
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    // Groups a toggle (mic/camera) with its device-picker caret so the caret reads as
    // attached to the button, Google Meet-style, while the row gap separates groups.
    deviceGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    },
  })
);

/**
 * The look both room toolbars share (professor and student): the row, the circular dark chip,
 * the leave pill, the divider and the device-group wrapper. Each toolbar used to carry its own
 * copy of these rules and a comment promising to keep them in sync; one definition removes the
 * promise. `chip` / `endCallChip` are the two class names every control is built from.
 */
export default function useToolbarChipStyles() {
  const classes = useStyles();
  return {
    classes,
    chip: clsx(classes.chipLayout, classes.chipDark),
    endCallChip: clsx(classes.chipLayout, classes.endCallChip),
  };
}
