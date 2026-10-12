import React from 'react';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import SmartphoneIcon from '@material-ui/icons/Smartphone';
import PersonOutlineIcon from '@material-ui/icons/PersonOutline';
import { ProctoringAlert } from '../../AttentionProvider/types';
import { AttentionPresence } from '../../AttentionProvider/presence';

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

/**
 * How the professor's surfaces show a participant WITHOUT an attention reading, keyed by why
 * (see classifyAttention). The roster draws a small flag (icon + tooltip), the Individual tab a
 * row with the same icon and label; each surface keeps its own `data-testid`s.
 */
export const presenceView: Record<
  Exclude<AttentionPresence, 'measured'>,
  { Icon: React.ElementType; label: string; rosterTestId: string; individualTestId: string }
> = {
  // Mobile device — the CV pipeline is desktop-only, so attention is simply not measurable
  // here. Distinct from "distracted" or "0%".
  unsupported: {
    Icon: SmartphoneIcon,
    label: 'No medible (celular)',
    rosterTestId: 'professor-room-shell-unsupported-flag',
    individualTestId: 'professor-room-shell-individual-unsupported',
  },
  // Camera off → no live attention. Show a muted state, never the stale value.
  cameraOff: {
    Icon: VideocamOffIcon,
    label: 'Cámara apagada',
    rosterTestId: 'professor-room-shell-cameraoff-flag',
    individualTestId: 'professor-room-shell-individual-cameraoff',
  },
  // Face not detected (turned away / lighting / angle) → the index has decayed to a placeholder
  // 0. Show "sin medición", NOT "0% attention": we cannot claim someone is distracted if we
  // cannot see their face.
  noFace: {
    Icon: VisibilityOffIcon,
    label: 'Sin medición — rostro no detectado',
    rosterTestId: 'professor-room-shell-nomeasure-flag',
    individualTestId: 'professor-room-shell-individual-nomeasure',
  },
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

/** Emoji cue for a notification pill, derived from the event copy. */
export function notificationEmoji(text: string): string {
  if (text.includes('levantó')) return '✋';
  if (text.includes('unió')) return '🔔';
  if (text.includes('salió')) return '👋';
  return '🔔';
}

export { getInitials } from '../roomIdentity';
