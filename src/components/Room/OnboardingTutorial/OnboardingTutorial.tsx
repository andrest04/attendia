import React, { useCallback, useEffect, useState } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';

// MUI icons — all in existing deps
import CameraAltIcon from '@material-ui/icons/CameraAlt';
import MemoryIcon from '@material-ui/icons/Memory';
import SecurityIcon from '@material-ui/icons/Security';
import CloseIcon from '@material-ui/icons/Close';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { routes } from '../../../routes';
import { createStorageSlot } from '../../../utils/createStorageSlot';
import { t } from '../../../i18n/translate';

// ---------------------------------------------------------------------------
// "Already seen" flag, kept per browser (a failing storage just shows the tour again)
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'attendia-onboarding-done';

const onboardingDone = createStorageSlot<true>({
  key: STORAGE_KEY,
  area: 'localStorage',
  parse: stored => (stored === true ? true : null),
});

const isOnboardingDone = (): boolean => onboardingDone.read() === true;

const markOnboardingDone = (): void => onboardingDone.write(true);

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
interface StepDef {
  accentColor: string;
  icon: React.ReactElement;
  title: string;
  body: string;
  callout: string;
  /** Icon shown inside the tinted callout. Defaults to InfoOutlinedIcon. */
  calloutIcon?: React.ElementType;
  /**
   * data-testid of the real room element this step points at. The tour draws a
   * highlight box over it (anchored at runtime via getBoundingClientRect). When
   * the element is absent (e.g. the student shell, or a step with no target) no
   * box is drawn — the step still renders fine.
   */
  anchorTestId?: string;
}

// Progress bar fill is the primary blue on every step (independent of the
// per-step accent color), and only the current segment is filled — matches Figma.
const PROGRESS_FILL_COLOR = '#1d6eed';

function onboardingSteps(): StepDef[] {
  return [
    {
      accentColor: '#1d6eed', // primary blue
      icon: <CameraAltIcon style={{ fontSize: 20 }} />,
      title: t('Controles de cámara y micrófono'),
      body: t(
        'Gestiona tu cámara y micrófono desde la barra de herramientas inferior. Puedes activarlos o desactivarlos en cualquier momento durante la sesión.'
      ),
      callout: t('El área resaltada en la parte inferior es la barra de herramientas principal.'),
      calloutIcon: CameraAltIcon,
      anchorTestId: 'professor-room-shell-toolbar-slot',
    },
    {
      accentColor: '#10b981', // success green
      icon: <MenuBookIcon style={{ fontSize: 20 }} />,
      title: t('Chat y participantes'),
      body: t(
        'Abre el panel derecho con estos botones de la barra de herramientas para ver la lista de participantes y comunicarte por el chat.'
      ),
      callout: t('Los botones resaltados abren los paneles de participantes y de chat.'),
      calloutIcon: MenuBookIcon,
      // Anchors to the toolbar buttons that OPEN the panel (not the panel itself):
      // the side rails start collapsed, so the rail element is not in the DOM when
      // the tour first runs.
      anchorTestId: 'professor-toolbar-panels',
    },
    {
      accentColor: '#ffb800', // warning amber
      icon: <MemoryIcon style={{ fontSize: 20 }} />,
      title: t('Detección de atención'),
      body: t(
        'El sistema analiza tu nivel de atención de forma local en tu dispositivo. Estos datos ayudan al profesor a entender el compromiso del grupo.'
      ),
      callout: t('Los datos faciales NO se almacenan ni se envían a servidores externos.'),
      calloutIcon: MemoryIcon,
      // No spotlight: the Figma copy here is about data privacy, not a highlighted
      // room zone, so this step intentionally points at nothing.
    },
    {
      accentColor: '#1d2f6f', // secondary navy
      icon: <SecurityIcon style={{ fontSize: 20 }} />,
      title: t('Privacidad y seguridad'),
      body: t(
        'Toda la comunicación está cifrada con SRTP. Los tokens de sesión se generan automáticamente y expiran al cerrar la sesión.'
      ),
      callout: t('Consulta la política de privacidad desde el pie de página.'),
      calloutIcon: SecurityIcon,
    },
  ];
}

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
  // Header row: (icon chip + step label over title) ... close button
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  chipAndText: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.75),
    minWidth: 0,
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  closeBtn: {
    padding: 6,
    marginTop: -2,
    marginRight: -6,
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },
  stepLabel: {
    fontSize: '0.72rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    letterSpacing: '0.02em',
    marginBottom: theme.spacing(0.25),
  },
  title: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.15rem',
    color: theme.palette.text.primary,
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
    fontSize: '0.9rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontFamily: 'inherit',
    '&:hover': {
      textDecoration: 'underline',
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
  const STEPS = onboardingSteps();
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
  const CalloutIcon = current.calloutIcon || InfoOutlinedIcon;

  return (
    <div
      className={classes.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={t('Tutorial de bienvenida')}
      data-testid="onboarding-backdrop"
    >
      {anchorRect &&
        (() => {
          // Clamp the 8px inset box to the viewport so an anchor near a screen edge
          // (common on narrow phones) never renders the spotlight partially off-screen.
          const top = Math.max(0, anchorRect.top - 8);
          const left = Math.max(0, anchorRect.left - 8);
          const right = Math.min(window.innerWidth, anchorRect.left + anchorRect.width + 8);
          const bottom = Math.min(window.innerHeight, anchorRect.top + anchorRect.height + 8);
          return (
            <div
              className={classes.spotlight}
              data-testid="onboarding-spotlight"
              style={{
                top,
                left,
                width: Math.max(0, right - left),
                height: Math.max(0, bottom - top),
                borderColor: current.accentColor,
                boxShadow: `0 0 0 4px ${current.accentColor}33, 0 0 28px 6px ${current.accentColor}55`,
              }}
            />
          );
        })()}
      <div className={classes.modal} data-testid="onboarding-modal">
        {/* Colored left border accent */}
        <div
          className={classes.accentBorder}
          style={{ backgroundColor: current.accentColor }}
          data-testid="onboarding-accent"
        />

        <div className={classes.inner}>
          {/* Header row: (icon chip + step label over title) ... close */}
          <div className={classes.headerRow}>
            <div className={classes.chipAndText}>
              <div
                className={classes.iconChip}
                style={{ backgroundColor: current.accentColor + '1A', color: current.accentColor }}
                data-testid="onboarding-icon-chip"
              >
                {current.icon}
              </div>
              <div className={classes.headerText}>
                <span className={classes.stepLabel} data-testid="onboarding-step-label">
                  {t('Paso {{current}} de {{total}}', { current: step + 1, total: STEPS.length })}
                </span>
                <Typography className={classes.title} data-testid="onboarding-title">
                  {current.title}
                </Typography>
              </div>
            </div>
            <IconButton
              size="small"
              className={classes.closeBtn}
              onClick={dismiss}
              aria-label={t('Cerrar tutorial')}
              data-testid="onboarding-close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>

          {/* Segmented progress bar */}
          <div className={classes.progressBar} data-testid="onboarding-progress">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={classes.progressSegment}
                style={i === step ? { backgroundColor: PROGRESS_FILL_COLOR } : undefined}
                data-testid={i === step ? 'onboarding-progress-filled' : 'onboarding-progress-empty'}
              />
            ))}
          </div>

          {/* Body text */}
          <Typography className={classes.body} data-testid="onboarding-body">
            {current.body}
          </Typography>

          {/* Tinted callout */}
          <div className={classes.callout} style={{ backgroundColor: calloutBg }} data-testid="onboarding-callout">
            <CalloutIcon className={classes.calloutIcon} style={{ color: calloutColor }} />
            <span className={classes.calloutText} style={{ color: calloutColor }}>
              {current.callout}
            </span>
          </div>

          {/* Footer */}
          <div className={classes.footer}>
            <button className={classes.skipLink} onClick={dismiss} data-testid="onboarding-skip">
              {t('Saltar tutorial')}
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
                  {t('← Anterior')}
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
                {isLast ? t('Comenzar') : t('Siguiente →')}
              </Button>
            </div>
          </div>

          {/* Manual link — opens the full manual in a new tab so the live room
              (this tutorial renders inside it) is never torn down by navigation. */}
          <div className={classes.manualRow}>
            <button
              className={classes.manualLink}
              onClick={() => window.open(routes.manual, '_blank', 'noopener')}
              aria-label={t('Acceder al manual completo')}
              data-testid="onboarding-manual"
            >
              <MenuBookIcon style={{ fontSize: 18 }} />
              {t('Acceder al manual completo')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export helper for tests
export { isOnboardingDone, markOnboardingDone, STORAGE_KEY };
