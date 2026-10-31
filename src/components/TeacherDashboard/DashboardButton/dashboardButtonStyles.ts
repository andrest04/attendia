import { darken, makeStyles, Theme } from '@material-ui/core/styles';

// Shared look of the dashboard's native <button>s. Two variants (primary / secondary) plus
// `danger` for the destructive bulk-delete. Layout (width, margin, flex, compact sizing) stays in
// each consumer's local class and is composed with these via `clsx`.
const DANGER_HOVER_BACKGROUND = '#fdf1f1';

const baseButton = (theme: Theme) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1.25, 2),
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  fontFamily: 'Poppins, Inter, sans-serif',
  fontWeight: 600,
  fontSize: '0.875rem',
});

const focusRing = (color: string) => ({
  outline: `2px solid ${color}`,
  outlineOffset: 2,
});

const disabledState = {
  cursor: 'default',
  opacity: 0.6,
};

export const useDashboardButtonStyles = makeStyles((theme: Theme) => ({
  primary: {
    ...baseButton(theme),
    border: 'none',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    transition: 'background-color 150ms ease',
    '&:hover:not(:disabled)': {
      backgroundColor: darken(theme.palette.primary.main, 0.12),
    },
    '&:focus-visible': focusRing(theme.palette.primary.main),
    '&:disabled': disabledState,
  },
  secondary: {
    ...baseButton(theme),
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    transition: 'background-color 150ms ease, border-color 150ms ease',
    '&:hover:not(:disabled)': {
      backgroundColor: '#ebf3ff',
      borderColor: theme.palette.primary.main,
    },
    '&:focus-visible': focusRing(theme.palette.primary.main),
    '&:disabled': disabledState,
  },
  danger: {
    ...baseButton(theme),
    border: `1px solid ${theme.palette.error.main}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.error.main,
    transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
    '&:hover:not(:disabled)': {
      backgroundColor: DANGER_HOVER_BACKGROUND,
      borderColor: darken(theme.palette.error.main, 0.12),
      color: darken(theme.palette.error.main, 0.12),
    },
    '&:focus-visible': focusRing(theme.palette.error.main),
    '&:disabled': disabledState,
  },
}));
