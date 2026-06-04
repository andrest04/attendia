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
  })
);
