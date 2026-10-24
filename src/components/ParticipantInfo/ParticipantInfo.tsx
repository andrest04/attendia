import React from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { Participant } from 'twilio-video';

import AudioLevelIndicator from '../AudioLevelIndicator/AudioLevelIndicator';
import AvatarIcon from '../../icons/AvatarIcon';
import NetworkQualityLevel from '../NetworkQualityLevel/NetworkQualityLevel';
import PinIcon from './PinIcon/PinIcon';
import ScreenShareIcon from '../../icons/ScreenShareIcon';
import Typography from '@material-ui/core/Typography';

import useParticipantTile from '../../hooks/useParticipantTile/useParticipantTile';
import { useAppState } from '../../state';
import TileModerationMenu from '../Room/ModerationMenu/TileModerationMenu';
import { StudentModerationHandlers } from '../Room/ModerationMenu/studentModerationItems';
import { AttentionLevel } from '../AttentionProvider/types';
import { ATTENTION_LEVEL_STYLE } from '../AttentionProvider/attentionLevelStyle';
import { isTeacherIdentity, stripTeacherSuffix } from '../../classSession/classSessionTypes';
import RoleBadge from '../RoleBadge/RoleBadge';
import RaisedHandBadge from '../ParticipantTileParts/RaisedHandBadge';
import ReconnectingOverlay from '../ParticipantTileParts/ReconnectingOverlay';
import { t } from '../../i18n/translate';

const borderWidth = 2;

/** Per-tile attention snapshot, surfaced on the professor's gallery only. */
export interface ParticipantTileAttention {
  level: AttentionLevel;
  multiface: boolean;
  /**
   * True only when the student has a real reading (classifyAttention === 'measured'). Otherwise
   * (camera off, phone, no face, no reading yet) the level is a placeholder → suppress the badge.
   */
  measured: boolean;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    container: {
      isolation: 'isolate',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: 0,
      overflow: 'hidden',
      marginBottom: '0.5em',
      '& video': {
        objectFit: 'contain !important',
      },
      borderRadius: '4px',
      border: `${theme.participantBorderWidth}px solid rgb(245, 248, 255)`,
      paddingTop: `calc(${(9 / 16) * 100}% - ${theme.participantBorderWidth}px)`,
      background: 'black',
      [theme.breakpoints.down('sm')]: {
        height: theme.sidebarMobileHeight,
        width: `${(theme.sidebarMobileHeight * 16) / 9}px`,
        marginRight: '8px',
        marginBottom: '0',
        fontSize: '12px',
        paddingTop: `${theme.sidebarMobileHeight - 2}px`,
      },
    },
    innerContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    },
    infoContainer: {
      position: 'absolute',
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: '100%',
      width: '100%',
      background: 'transparent',
      top: 0,
    },
    avatarContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'black',
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 1,
      [theme.breakpoints.down('sm')]: {
        '& svg': {
          transform: 'scale(0.7)',
        },
      },
    },
    screenShareIconContainer: {
      background: 'rgba(0, 0, 0, 0.5)',
      padding: '0.18em 0.3em',
      marginRight: '0.3em',
      display: 'flex',
      '& path': {
        fill: 'white',
      },
    },
    identity: {
      background: 'rgba(0, 0, 0, 0.5)',
      color: 'white',
      padding: '0.18em 0.3em 0.18em 0',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
    },
    infoRowBottom: {
      display: 'flex',
      justifyContent: 'space-between',
      position: 'absolute',
      bottom: 0,
      left: 0,
    },
    typography: {
      color: 'white',
      [theme.breakpoints.down('sm')]: {
        fontSize: '0.75rem',
      },
    },
    hideParticipant: {
      display: 'none',
    },
    cursorPointer: {
      cursor: 'pointer',
    },
    galleryView: {
      border: `${theme.participantBorderWidth}px solid ${theme.galleryViewBackgroundColor}`,
      borderRadius: '8px',
      [theme.breakpoints.down('sm')]: {
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: '0',
        fontSize: '12px',
        margin: '0',
        '& video': {
          objectFit: 'cover !important',
        },
      },
    },
    dominantSpeaker: {
      border: `solid ${borderWidth}px #7BEAA5`,
    },
    // Attendia: the teacher's tile gets an accent ring so students spot it at a
    // glance in the gallery. boxShadow (not border) so it never fights the
    // dominantSpeaker / galleryView border.
    teacherTile: {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}, 0 0 0 4px rgba(29,110,237,0.25)`,
    },
    roleBadge: {
      marginLeft: '0.4em',
      marginRight: '0.3em',
    },
    // Attendia: multiface → red border on the tile.
    multifaceTile: {
      border: `1.5px solid rgba(239,68,68,0.9)`,
      boxShadow: '0 0 0 2px rgba(239,68,68,0.3)',
    },
    multifacePill: {
      position: 'absolute',
      top: 8,
      left: 8,
      zIndex: 3,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 9px',
      borderRadius: 8,
      fontSize: 10,
      fontWeight: 700,
      fontFamily: 'Poppins, Inter, sans-serif',
      lineHeight: 1.5,
      backgroundColor: 'rgba(239,68,68,0.9)',
      color: '#FFFFFF',
      whiteSpace: 'nowrap',
    },
    attentionLevelBadge: {
      position: 'absolute',
      bottom: 28,
      right: 6,
      zIndex: 3,
      fontSize: 11,
      fontWeight: 700,
      fontFamily: 'Poppins, Inter, sans-serif',
      lineHeight: '22.5px',
      padding: '0 10px',
      borderRadius: 20,
      whiteSpace: 'nowrap',
    },
  })
);

interface ParticipantInfoProps {
  participant: Participant;
  children: React.ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
  isLocalParticipant?: boolean;
  hideParticipant?: boolean;
  isDominantSpeaker?: boolean;
  /** Attention badge + multiface flag for the professor's gallery (US08/US25). */
  attention?: ParticipantTileAttention;
  /** Moderation actions for this tile's student; set only for a teacher viewing a remote student. */
  moderation?: StudentModerationHandlers;
}

export default function ParticipantInfo({
  participant,
  onClick,
  isSelected,
  children,
  isLocalParticipant,
  hideParticipant,
  isDominantSpeaker,
  attention,
  moderation,
}: ParticipantInfoProps) {
  const {
    audioTrack,
    hasVideoPublication: isVideoEnabled,
    isSharingScreen: isScreenShareEnabled,
    isVideoSwitchedOff,
    isReconnecting: isParticipantReconnecting,
    isHandRaised,
  } = useParticipantTile(participant);

  const { isGalleryViewActive } = useAppState();

  const classes = useStyles();

  const hasMultiface = Boolean(attention && attention.multiface);

  const isTeacher = isTeacherIdentity(participant.identity);

  return (
    <div
      className={clsx(classes.container, {
        [classes.hideParticipant]: hideParticipant,
        [classes.cursorPointer]: Boolean(onClick),
        [classes.dominantSpeaker]: isDominantSpeaker,
        [classes.galleryView]: isGalleryViewActive,
        [classes.multifaceTile]: hasMultiface,
        [classes.teacherTile]: isTeacher,
      })}
      onClick={onClick}
      data-cy-participant={participant.identity}
    >
      <div className={classes.infoContainer}>
        {moderation && <TileModerationMenu identity={participant.identity} handlers={moderation} />}
        {attention && (
          <>
            {attention.multiface && (
              <span
                className={classes.multifacePill}
                title={t('Múltiples rostros detectados')}
                data-testid="participant-multiface-flag"
              >
                {t('Multi-rostro')}
              </span>
            )}
            {/* Level badge only for a real reading: camera off, phone, no face or no reading
                yet would otherwise show a placeholder level (e.g. "Bajo"). */}
            {attention.measured && (
              <span
                className={classes.attentionLevelBadge}
                data-testid="participant-attention-overlay"
                style={{
                  backgroundColor: ATTENTION_LEVEL_STYLE[attention.level].badgeBg,
                  color: ATTENTION_LEVEL_STYLE[attention.level].badgeText,
                }}
              >
                {ATTENTION_LEVEL_STYLE[attention.level].label}
              </span>
            )}
          </>
        )}
        <NetworkQualityLevel participant={participant} />
        <div className={classes.infoRowBottom}>
          {isScreenShareEnabled && (
            <span className={classes.screenShareIconContainer}>
              <ScreenShareIcon />
            </span>
          )}
          <span className={classes.identity}>
            <AudioLevelIndicator audioTrack={audioTrack} />
            <Typography variant="body1" className={classes.typography} component="span">
              {stripTeacherSuffix(participant.identity)}
              {isLocalParticipant && ' (Yo)'}
            </Typography>
            {isTeacher && <RoleBadge size="sm" className={classes.roleBadge} />}
          </span>
        </div>
        <div>{isSelected && <PinIcon />}</div>
        {isHandRaised && <RaisedHandBadge size="tile" />}
      </div>
      <div className={classes.innerContainer}>
        {(!isVideoEnabled || isVideoSwitchedOff) && (
          <div className={classes.avatarContainer}>
            <AvatarIcon />
          </div>
        )}
        {isParticipantReconnecting && <ReconnectingOverlay compact />}
        {children}
      </div>
    </div>
  );
}
