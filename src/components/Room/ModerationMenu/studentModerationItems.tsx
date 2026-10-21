import React from 'react';
import MicOffIcon from '@material-ui/icons/MicOff';
import MicIcon from '@material-ui/icons/Mic';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import VideocamIcon from '@material-ui/icons/Videocam';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import { OverflowMenuItem } from '../ToolbarParts/OverflowMenu';
import { isTeacherIdentity } from '../../../classSession/classSessionTypes';
import { canModerate, ModerationActorRole } from '../../../hooks/useClassDataChannel/classProtocol';

/** What a teacher can do to one student. A missing handler removes its menu item. */
export interface StudentModerationHandlers {
  onMuteParticipant?: (identity: string) => void;
  onRequestUnmute?: (identity: string) => void;
  onMuteVideo?: (identity: string) => void;
  onRequestVideo?: (identity: string) => void;
  onSetScreenShareGrant?: (identity: string, allowed: boolean) => void;
  /** Identities currently allowed to share their screen. */
  screenShareGrants?: string[];
  /** The local teacher's standing in the room; gates moderating another teacher. */
  actorRole?: ModerationActorRole;
}

const ICON_STYLE = { fontSize: 16 };

/**
 * The single source of the per-student moderation menu, shared by the roster row and the
 * student's video tile. Items are data; `testIdPrefix` keeps each host's test ids stable.
 */
export function buildStudentModerationItems(
  identity: string,
  handlers: StudentModerationHandlers,
  testIdPrefix: string
): OverflowMenuItem[] {
  const { onMuteParticipant, onRequestUnmute, onMuteVideo, onRequestVideo, onSetScreenShareGrant } = handlers;
  const isSharingAllowed = (handlers.screenShareGrants || []).includes(identity);
  const items: Array<OverflowMenuItem | undefined> = [
    onMuteParticipant && {
      testId: `${testIdPrefix}-mute`,
      label: 'Silenciar',
      icon: <MicOffIcon style={ICON_STYLE} />,
      onSelect: () => onMuteParticipant(identity),
    },
    onRequestUnmute && {
      testId: `${testIdPrefix}-request-unmute`,
      label: 'Pedir activar micrófono',
      icon: <MicIcon style={ICON_STYLE} />,
      onSelect: () => onRequestUnmute(identity),
    },
    onMuteVideo && {
      testId: `${testIdPrefix}-mute-video`,
      label: 'Apagar cámara',
      icon: <VideocamOffIcon style={ICON_STYLE} />,
      onSelect: () => onMuteVideo(identity),
    },
    onRequestVideo && {
      testId: `${testIdPrefix}-request-video`,
      label: 'Sugerir cámara',
      icon: <VideocamIcon style={ICON_STYLE} />,
      onSelect: () => onRequestVideo(identity),
    },
    onSetScreenShareGrant && {
      testId: `${testIdPrefix}-screenshare`,
      label: isSharingAllowed ? 'Quitar permiso de pantalla' : 'Permitir compartir pantalla',
      icon: <ScreenShareIcon style={ICON_STYLE} />,
      onSelect: () => onSetScreenShareGrant(identity, !isSharingAllowed),
    },
  ];
  return items.filter((item): item is OverflowMenuItem => Boolean(item));
}

/**
 * The moderation menu for any participant, honoring the owner/co-teacher rule (`canModerate`).
 * A teacher target never gets the screen-share grant: only forced-off actions and suggestions.
 */
export function buildModerationItemsForTarget(
  target: { identity: string; isLocal: boolean },
  handlers: StudentModerationHandlers,
  testIdPrefix: string,
  actorRole: ModerationActorRole | undefined = handlers.actorRole
): OverflowMenuItem[] {
  const isTeacher = isTeacherIdentity(target.identity);
  if (!canModerate(actorRole, { isTeacher, isLocal: target.isLocal })) return [];
  const allowed = isTeacher ? { ...handlers, onSetScreenShareGrant: undefined } : handlers;
  return buildStudentModerationItems(target.identity, allowed, testIdPrefix);
}
