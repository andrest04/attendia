import { AttentionLevel } from './types';

/**
 * Single source of truth for how an attention level LOOKS and is NAMED, shared by the professor
 * roster, the per-tile gallery badge, the group gauge and the report. Five parallel
 * `Record<AttentionLevel, …>` tables (and two identical copies of the badge pair) used to say
 * this separately, so a tweak to one level's colors had to be repeated by hand.
 *
 * The values are frozen, shared objects (a flyweight): consumers read a field, nobody builds
 * their own copy. Two fields intentionally look alike but are separate because they are
 * different design decisions that happen to coincide today:
 *  - `trackBg` (the gauge track) equals `badgeBg`;
 *  - the report's chip (`reportChipBg`/`reportChipText`) differs from the in-room badge for
 *    "medium" — a warmer amber on the printed-style table than on the live roster.
 */
export interface AttentionLevelStyle {
  /** Solid indicator color (bars on the roster and report). */
  color: string;
  /** Spanish name of the level ("nivel alto/medio/bajo"). */
  label: string;
  /** In-room pill: background and text (roster rows and gallery tiles). */
  badgeBg: string;
  badgeText: string;
  /** Background track behind the group gauge arc. */
  trackBg: string;
  /** Report table chip: background and text. */
  reportChipBg: string;
  reportChipText: string;
}

export const ATTENTION_LEVEL_STYLE: Readonly<Record<AttentionLevel, Readonly<AttentionLevelStyle>>> = Object.freeze({
  high: Object.freeze({
    color: '#14B053',
    label: 'Alto',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
    trackBg: '#d1fae5',
    reportChipBg: '#d1fae5',
    reportChipText: '#065f46',
  }),
  medium: Object.freeze({
    color: '#E6A817',
    label: 'Medio',
    badgeBg: '#fff8e1',
    badgeText: '#7c4e00',
    trackBg: '#fff8e1',
    reportChipBg: '#fef3c7',
    reportChipText: '#92400e',
  }),
  low: Object.freeze({
    color: '#E22525',
    label: 'Bajo',
    badgeBg: '#fee2e2',
    badgeText: '#991b1b',
    trackBg: '#fee2e2',
    reportChipBg: '#fee2e2',
    reportChipText: '#991b1b',
  }),
});
