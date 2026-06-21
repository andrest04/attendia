import React, { useCallback, useEffect, useState } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';

// MUI icons — all in existing deps
import VideocamIcon from '@material-ui/icons/Videocam';
import ChatIcon from '@material-ui/icons/Chat';
import TrackChangesIcon from '@material-ui/icons/TrackChanges';
import SecurityIcon from '@material-ui/icons/Security';
import CloseIcon from '@material-ui/icons/Close';
import MonitorIcon from '@material-ui/icons/DesktopMac';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';

// ---------------------------------------------------------------------------
// localStorage helpers (mirrors rejoinSession.ts pattern — swallow errors)
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'attendia-onboarding-done';

function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // swallow
  }
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
interface StepDef {
  accentColor: string;
  icon: React.ReactElement;
  title: string;
  body: string;
  callout: string;
  /**
   * data-testid of the real room element this step points at. The tour draws a
   * highlight box over it (anchored at runtime via getBoundingClientRect). When
   * the element is absent (e.g. the student shell, or a step with no target) no
   * box is drawn — the step still renders fine.
   */
  anchorTestId?: string;
}

const STEPS: StepDef[] = [
  {
    accentColor: '#1d6eed', // primary blue
    icon: <VideocamIcon style={{ fontSize: 20 }} />,
    title: 'Controles de cámara y micrófono',
    body:
      'Gestiona tu cámara y micrófono desde la barra de herramientas inferior. Puedes activarlos o desactivarlos en cualquier momento durante la sesión.',
    callout: 'El área resaltada en la parte inferior es la barra de herramientas principal.',
    anchorTestId: 'professor-room-shell-toolbar-slot',
  },
  {
    accentColor: '#10b981', // success green
    icon: <ChatIcon style={{ fontSize: 20 }} />,
    title: 'Chat y participantes',
    body: 'Usa el panel derecho para comunicarte con el profesor y ver la lista de participantes de la sesión.',
    callout: 'El panel derecho resaltado reúne la atención del grupo, el detalle individual y el chat.',
    anchorTestId: 'professor-room-shell-right-rail',
  },
  {
    accentColor: '#ffb800', // warning amber
    icon: <TrackChangesIcon style={{ fontSize: 20 }} />,
    title: 'Detección de atención',
    body:
      'El sistema analiza tu nivel de atención de forma local en tu dispositivo. Estos datos ayudan al profesor a entender el compromiso del grupo.',
    callout: 'El indicador resaltado muestra la atención del grupo en tiempo real.',
    anchorTestId: 'professor-room-shell-group-gauge',
  },
  {
    accentColor: '#1d2f6f', // secondary navy
    icon: <SecurityIcon style={{ fontSize: 20 }} />,
    title: 'Privacidad y seguridad',
    body:
      'Toda la comunicación está cifrada con SRTP. Los tokens de sesión se generan automáticamente y expiran al cerrar la sesión.',
    callout: 'El análisis facial corre solo en tu navegador; ninguna imagen sale de tu dispositivo.',
  },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const useStyles = makeStyles((theme: Theme) => ({
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: theme.zIndex.modal + 10,
    backgroundColor: 'rgba(15, 30, 69, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
  },
  // Highlight box drawn over the real room zone a step points at. Position
  // (top/left/width/height) is set inline from the anchor's bounding rect.
  spotlight: {
    position: 'fixed',
    borderRadius: 12,
    border: '2px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.12), 0 0 28px 6px rgba(255, 255, 255, 0.25)',
    pointerEvents: 'none',
    transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
  },
  modal: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(15, 30, 69, 0.25)',
    width: '100%',
    maxWidth: 520,
    overflow: 'hidden',
    outline: 'none',
  },
  accentBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderRadius: '16px 0 0 16px',
    transition: 'background-color 0.3s ease',
  },
  inner: {
    padding: theme.spacing(3.5, 4, 3, 4),
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(2.5, 2.5, 2, 2.5),
    },
  },
  // Header row: icon chip + step label + close
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.5),
  },
  chipAndLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.3s ease',
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: '0.7rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    letterSpacing: '0.02em',
  },
  closeBtn: {
    padding: 6,
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
  },
  title: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.15rem',
    color: theme.palette.text.primary,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
    letterSpacing: '-0.02em',
    lineHeight: 1.3,
  },
  // Segmented progress bar
  progressBar: {
    display: 'flex',
    gap: 4,
    marginBottom: theme.spacing(2.5),
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.palette.action.hover,
    transition: 'background-color 0.3s ease',
  },
  progressSegmentFilled: {
    // dynamic via inline style
  },
  body: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    lineHeight: 1.65,
    marginBottom: theme.spacing(2),
  },
  callout: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderRadius: 8,
    marginBottom: theme.spacing(3),
    transition: 'background-color 0.3s ease',
  },
  calloutIcon: {
    flexShrink: 0,
    fontSize: 17,
    marginTop: 1,
    transition: 'color 0.3s ease',
  },
  calloutText: {
    fontSize: '0.8rem',
    lineHeight: 1.55,
    fontWeight: 500,
    transition: 'color 0.3s ease',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(2),
    marginTop: theme.spacing(0.5),
  },
  skipLink: {
    fontSize: '0.82rem',
    color: theme.palette.text.secondary,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    fontFamily: 'inherit',
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  navButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  prevBtn: {
    fontWeight: 500,
    fontSize: '0.85rem',
    borderColor: theme.palette.divider,
    color: theme.palette.text.primary,
    padding: '6px 18px',
  },
  nextBtn: {
    fontWeight: 600,
    fontSize: '0.85rem',
    padding: '6px 22px',
  },
  // Row centers the link; the clickable area is the link itself, not the full width.
  manualRow: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(0.5),
  },
  manualLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.25, 0.5),
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    textDecoration: 'underline',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontFamily: 'inherit',
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  /** Skip rendering entirely when false (mobile paths are excluded by caller). */
  enabled?: boolean;
  /**
   * Monotonic counter bumped by an external trigger (the professor's "Ayuda"
   * button) to force-reopen the tour from step 0, ignoring the "already seen"
   * localStorage flag. Starts at 0 so it never opens the tour on first mount.
   */
  openSignal?: number;
}

export default function OnboardingTutorial({ enabled = true, openSignal = 0 }: Props) {
  const classes = useStyles();
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (enabled && !isOnboardingDone()) {
      setIsVisible(true);
    }
  }, [enabled]);

  // External re-open: each time openSignal increments, restart the tour at step 0.
  // Guarded against the initial 0 so a fresh mount does not auto-open through this path.
  useEffect(() => {
    if (openSignal > 0) {
      setStep(0);
      setIsVisible(true);
    }
  }, [openSignal]);

  // Bounding rect of the current step's anchor element, in viewport coords.
  // null when the step has no anchor or the element is not on the page (e.g. the
  // student shell) — in which case no highlight box is drawn.
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setAnchorRect(null);
      return;
    }
    const testId = STEPS[step].anchorTestId;
    if (!testId) {
      setAnchorRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      setAnchorRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    // Re-measure on the next frame in case layout settles after the modal mounts,
    // and whenever the viewport changes size.
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [isVisible, step]);

  const dismiss = useCallback(() => {
    markOnboardingDone();
    setIsVisible(false);
  }, []);

  const goNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const goPrev = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
  }, []);

  // Keyboard dismiss
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isVisible, dismiss, goNext, goPrev]);

  if (!isVisible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  // Callout tint derived from accent (very light wash)
  const calloutBg = current.accentColor + '14'; // ~8% opacity
  const calloutColor = current.accentColor;

  return (
    <div
      className={classes.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial de bienvenida"
      data-testid="onboarding-backdrop"
    >
      {anchorRect && (
        <div
          className={classes.spotlight}
          data-testid="onboarding-spotlight"
          style={{
            top: anchorRect.top - 8,
            left: anchorRect.left - 8,
            width: anchorRect.width + 16,
            height: anchorRect.height + 16,
            borderColor: current.accentColor,
            boxShadow: `0 0 0 4px ${current.accentColor}33, 0 0 28px 6px ${current.accentColor}55`,
          }}
        />
      )}
      <div className={classes.modal} data-testid="onboarding-modal">
        {/* Colored left border accent */}
        <div
          className={classes.accentBorder}
          style={{ backgroundColor: current.accentColor }}
          data-testid="onboarding-accent"
        />

        <div className={classes.inner}>
          {/* Header row */}
          <div className={classes.headerRow}>
            <div className={classes.chipAndLabel}>
              <div
                className={classes.iconChip}
                style={{ backgroundColor: current.accentColor }}
                data-testid="onboarding-icon-chip"
              >
                {current.icon}
              </div>
              <span className={classes.stepLabel} data-testid="onboarding-step-label">
                Paso {step + 1} de {STEPS.length}
              </span>
            </div>
            <IconButton
              size="small"
              className={classes.closeBtn}
              onClick={dismiss}
              aria-label="Cerrar tutorial"
              data-testid="onboarding-close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>

          {/* Title */}
          <Typography className={classes.title} data-testid="onboarding-title">
            {current.title}
          </Typography>

          {/* Segmented progress bar */}
          <div className={classes.progressBar} data-testid="onboarding-progress">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={classes.progressSegment}
                style={i <= step ? { backgroundColor: current.accentColor } : undefined}
                data-testid={i <= step ? 'onboarding-progress-filled' : 'onboarding-progress-empty'}
              />
            ))}
          </div>

          {/* Body text */}
          <Typography className={classes.body} data-testid="onboarding-body">
            {current.body}
          </Typography>

          {/* Tinted callout */}
          <div className={classes.callout} style={{ backgroundColor: calloutBg }} data-testid="onboarding-callout">
            <InfoOutlinedIcon className={classes.calloutIcon} style={{ color: calloutColor }} />
            <span className={classes.calloutText} style={{ color: calloutColor }}>
              {current.callout}
            </span>
          </div>

          {/* Footer */}
          <div className={classes.footer}>
            <button className={classes.skipLink} onClick={dismiss} data-testid="onboarding-skip">
              Saltar tutorial
            </button>

            <div className={classes.navButtons}>
              {!isFirst && (
                <Button
                  variant="outlined"
                  size="small"
                  className={classes.prevBtn}
                  onClick={goPrev}
                  data-testid="onboarding-prev"
                >
                  ← Anterior
                </Button>
              )}
              <Button
                variant="contained"
                color="primary"
                size="small"
                className={classes.nextBtn}
                onClick={goNext}
                data-testid="onboarding-next"
              >
                {isLast ? 'Comenzar' : 'Siguiente →'}
              </Button>
            </div>
          </div>

          {/* Manual link — opens the full manual in a new tab so the live room
              (this tutorial renders inside it) is never torn down by navigation. */}
          <div className={classes.manualRow}>
            <button
              className={classes.manualLink}
              onClick={() => window.open('/manual', '_blank', 'noopener')}
              aria-label="Acceder al manual completo"
              data-testid="onboarding-manual"
            >
              <MonitorIcon style={{ fontSize: 15 }} />
              Acceder al manual completo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export helper for tests
export { isOnboardingDone, markOnboardingDone, STORAGE_KEY };
