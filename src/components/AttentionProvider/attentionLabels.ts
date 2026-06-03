import { AttentionLevel, ProctoringAlert } from './types';

/**
 * Single source of truth for attention level/proctoring presentation, shared by
 * the professor roster, the per-tile gallery badge, and the exported report so
 * they can never drift apart.
 */

/** Color per attention level. */
export const levelColor: Record<AttentionLevel, string> = {
  high: '#14B053',
  medium: '#E6A817',
  low: '#E22525',
};

/** Feminine labels ("atención alta/media/baja") — roster + exported report. */
export const levelLabel: Record<AttentionLevel, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

/** Masculine short labels ("nivel alto/medio/bajo") — per-tile gallery badge. */
export const levelShortLabel: Record<AttentionLevel, string> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

export const proctoringKindLabel: Record<ProctoringAlert['kind'], string> = {
  multiface: 'Múltiples rostros',
  absent: 'Sin presencia',
  away: 'Ausente',
};
