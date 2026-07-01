import React from 'react';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import PersonOutlineIcon from '@material-ui/icons/PersonOutline';
import { AttentionLevel, ProctoringAlert } from '../../AttentionProvider/types';

// Leaf module for the ProfessorRoomShell family: pure helpers, shared maps, and the
// right-rail tab type. Kept dependency-light (only AttentionProvider types + MUI
// icons) so the shell and its subcomponents can all import from here without a
// cycle, and so Room.tsx can import ProfessorRightTab directly (isolatedModules
// forbids re-exporting a type through the barrel).

/** Right-rail tab identity for the professor shell. */
export type ProfessorRightTab = 'grupo' | 'individual' | 'chat';

export type ProctoringKind = ProctoringAlert['kind'];

// Per-kind icon for the proctoring feed and modal, so the cue matches the actual
// condition instead of a single generic warning glyph.
export const proctoringKindIcon: Record<ProctoringKind, React.ComponentType<{ style?: React.CSSProperties }>> = {
  'camera-off': VideocamOffIcon,
  multiface: PeopleAltIcon,
  away: VisibilityOffIcon,
  absent: PersonOutlineIcon,
};

// Honest, kind-specific copy. Note we do NOT claim an exact face count: the live
// pipeline does not carry one in the alert and the number fluctuates per sample.
export function proctoringKindMessage(kind: ProctoringKind, name: string, detectedAt: string): string {
  switch (kind) {
    case 'camera-off':
      return `${name} apagó su cámara. No hay datos de atención mientras esté apagada · Detectado a las ${detectedAt}`;
    case 'multiface':
      return `Se detectaron varios rostros en la cámara de ${name} · Detectado a las ${detectedAt}`;
    case 'away':
      return `${name} apartó la mirada de la pantalla · Detectado a las ${detectedAt}`;
    case 'absent':
      return `No se detecta a ${name} frente a la cámara · Detectado a las ${detectedAt}`;
  }
}

// Attention level → badge background / text pairs from the attendia design.
export const attBadgeBg: Record<AttentionLevel, string> = {
  high: '#d1fae5',
  medium: '#fff8e1',
  low: '#fee2e2',
};
export const attBadgeText: Record<AttentionLevel, string> = {
  high: '#065f46',
  medium: '#7c4e00',
  low: '#991b1b',
};

/** Emoji cue for a notification pill, derived from the event copy. */
export function notificationEmoji(text: string): string {
  if (text.includes('levantó')) return '✋';
  if (text.includes('unió')) return '🔔';
  if (text.includes('salió')) return '👋';
  return '🔔';
}

/** Returns up to 2 uppercase initials from an identity string. */
export function getInitials(identity: string): string {
  const parts = identity
    .replace(/\[.*?\]/g, '')
    .trim()
    .split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
