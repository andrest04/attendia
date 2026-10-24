import { t } from '../../i18n/translate';
import { ATTENTION_RANGES } from './attentionFormula';
import { ProctoringAlert } from './types';

/**
 * The proctoring conditions the live pipeline can raise — one entry per kind, so that adding
 * a kind is a compile error everywhere it matters (Record<Kind, …>) instead of an easily
 * missed `case` in a handful of switches. Presentation that needs icons or severity lives
 * with the UI (professorShellHelpers); this registry is the domain half: what a kind is
 * called, what the student is told, and how sure we are.
 */
export type ProctoringKind = ProctoringAlert['kind'];

export interface ProctoringKindInfo {
  /** Professor-facing name ("Sin presencia"). */
  label: string;
  /** What the student is told when the professor warns them about this condition. */
  studentWarning: string;
  /**
   * Confidence shown in the alert card. The MediaPipe signals are effectively binary
   * (camera off / no face / multiple faces), so they report 1.0; 'away' (sustained low
   * attention) is a softer inference, hence < 1.
   */
  confidence: number;
}

export const PROCTORING_KINDS: Record<ProctoringKind, ProctoringKindInfo> = {
  multiface: {
    label: t('Múltiples rostros'),
    studentWarning: t('El profesor detectó varias personas en tu cámara'),
    confidence: 1.0,
  },
  absent: {
    label: 'Sin presencia',
    studentWarning: t('El profesor no te detecta frente a la cámara'),
    confidence: 1.0,
  },
  away: {
    label: t('Distraído'),
    studentWarning: t('El profesor te pidió volver a concentrarte en la clase'),
    confidence: 0.9,
  },
  'camera-off': {
    label: t('Cámara apagada'),
    studentWarning: t('El profesor te pidió encender tu cámara'),
    confidence: 1.0,
  },
};

/** One remote telemetry sample, as far as proctoring is concerned. */
export interface ProctoringSample {
  cameraOff: boolean;
  faces: number;
  index: number;
  unsupported?: boolean;
  /** Camera on but no reading yet: there is nothing to judge, so it raises nothing. */
  pending?: boolean;
}

/**
 * The detectors, in PRIORITY order: the first that matches wins, so the kinds are mutually
 * exclusive per participant per sample and one participant never produces two simultaneous
 * alerts. The order is behavior — camera off → no face → multiple faces → sustained low
 * attention. ('away' is only reached with exactly one face present, since the earlier
 * detectors already took the 0 and >1 cases.)
 */
const DETECTORS: Array<{ kind: ProctoringKind; matches(sample: ProctoringSample): boolean }> = [
  { kind: 'camera-off', matches: sample => sample.cameraOff },
  { kind: 'absent', matches: sample => sample.faces === 0 },
  { kind: 'multiface', matches: sample => sample.faces > 1 },
  { kind: 'away', matches: sample => sample.index <= ATTENTION_RANGES.lowMax },
];

/** Classifies ONE sample into at most one proctoring condition (null when it shows none). */
export function classifyProctoring(sample: ProctoringSample): ProctoringKind | null {
  // A mobile (unsupported) device cannot measure — it is not a proctoring event.
  if (sample.unsupported) return null;
  // No reading yet (analysis loading or failed) is not an absence either.
  if (sample.pending) return null;
  const detector = DETECTORS.find(candidate => candidate.matches(sample));
  return detector ? detector.kind : null;
}
