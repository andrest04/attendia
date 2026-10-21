import React from 'react';
import { TFunction } from 'i18next';
import MicOffIcon from '@material-ui/icons/MicOff';
import MicIcon from '@material-ui/icons/Mic';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import VideocamIcon from '@material-ui/icons/Videocam';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import { OverflowMenuItem } from '../ToolbarParts/OverflowMenu';
import { isTeacherIdentity } from '../../../classSession/classSessionTypes';
import { canModerate, ModerationActorRole } from '../../../hooks/useClassDataChannel/classProtocol';
import spanishTranslator from '../../../i18n/spanishTranslator';

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
 * student's video tile. Items are data; `testIdPrefix` keeps each host's test ids stable. Labels
 * come from `t` (the UI language); callers that have not been migrated get Spanish.
 */
export function buildStudentModerationItems(
  identity: string,
  handlers: StudentModerationHandlers,
  testIdPrefix: string,
  t: TFunction = spanishTranslator
): OverflowMenuItem[] {
  const { onMuteParticipant, onRequestUnmute, onMuteVideo, onRequestVideo, onSetScreenShareGrant } = handlers;
  const isSharingAllowed = (handlers.screenShareGrants || []).includes(identity);
  const items: Array<OverflowMenuItem | undefined> = [
    onMuteParticipant && {
      testId: `${testIdPrefix}-mute`,
      label: t('room:moderation.mute'),
      icon: <MicOffIcon style={ICON_STYLE} />,
      onSelect: () => onMuteParticipant(identity),
    },
    onRequestUnmute && {
      testId: `${testIdPrefix}-request-unmute`,
      label: t('room:moderation.requestUnmute'),
      icon: <MicIcon style={ICON_STYLE} />,
      onSelect: () => onRequestUnmute(identity),
    },
    onMuteVideo && {
      testId: `${testIdPrefix}-mute-video`,
      label: t('room:moderation.muteVideo'),
      icon: <VideocamOffIcon style={ICON_STYLE} />,
      onSelect: () => onMuteVideo(identity),
    },
    onRequestVideo && {
      testId: `${testIdPrefix}-request-video`,
      label: t('room:moderation.requestVideo'),
      icon: <VideocamIcon style={ICON_STYLE} />,
      onSelect: () => onRequestVideo(identity),
    },
    onSetScreenShareGrant && {
      testId: `${testIdPrefix}-screenshare`,
      label: isSharingAllowed ? t('room:moderation.revokeScreenShare') : t('room:moderation.allowScreenShare'),
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
  actorRole: ModerationActorRole | undefined = handlers.actorRole,
  t: TFunction = spanishTranslator
): OverflowMenuItem[] {
  const isTeacher = isTeacherIdentity(target.identity);
  if (!canModerate(actorRole, { isTeacher, isLocal: target.isLocal })) return [];
  const allowed = isTeacher ? { ...handlers, onSetScreenShareGrant: undefined } : handlers;
  return buildStudentModerationItems(target.identity, allowed, testIdPrefix, t);
}
