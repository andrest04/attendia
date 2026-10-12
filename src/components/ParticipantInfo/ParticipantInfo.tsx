import React from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { LocalAudioTrack, LocalVideoTrack, Participant, RemoteAudioTrack, RemoteVideoTrack } from 'twilio-video';

import AudioLevelIndicator from '../AudioLevelIndicator/AudioLevelIndicator';
import AvatarIcon from '../../icons/AvatarIcon';
import PanToolIcon from '@material-ui/icons/PanTool';
import NetworkQualityLevel from '../NetworkQualityLevel/NetworkQualityLevel';
import PinIcon from './PinIcon/PinIcon';
import ScreenShareIcon from '../../icons/ScreenShareIcon';
import Typography from '@material-ui/core/Typography';

import useIsTrackSwitchedOff from '../../hooks/useIsTrackSwitchedOff/useIsTrackSwitchedOff';
import usePublications from '../../hooks/usePublications/usePublications';
import useTrack from '../../hooks/useTrack/useTrack';
import useParticipantIsReconnecting from '../../hooks/useParticipantIsReconnecting/useParticipantIsReconnecting';
import { useAppState } from '../../state';
import { AttentionLevel } from '../AttentionProvider/types';
import { ATTENTION_LEVEL_STYLE } from '../AttentionProvider/attentionLevelStyle';
import { useRaisedHand } from '../../hooks/useRaiseHand/raisedHandsContext';
import { isTeacherIdentity, stripTeacherSuffix } from '../PreJoinScreens/classSessionTypes';
import RoleBadge from '../RoleBadge/RoleBadge';
import { isScreenShareName } from '../../utils/trackSelectors';

const borderWidth = 2;

/** Per-tile attention snapshot, surfaced on the professor's gallery only. */
export interface ParticipantTileAttention {
  level: AttentionLevel;
  multiface: boolean;
  /** When true, the camera is off and the level is stale → suppress the badge. */
  cameraOff?: boolean;
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
    reconnectingContainer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(40, 42, 43, 0.75)',
      zIndex: 1,
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
    // Raised-hand badge — bottom-right corner of the tile of whoever raised their hand.
    raisedHandBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      zIndex: 4,
      width: 30,
      height: 30,
      borderRadius: '50%',
      backgroundColor: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 16,
      lineHeight: 1,
      boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
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
}: ParticipantInfoProps) {
  const publications = usePublications(participant);

  const audioPublication = publications.find(p => p.kind === 'audio');
  const videoPublication = publications.find(p => !isScreenShareName(p.trackName) && p.kind === 'video');

  const isVideoEnabled = Boolean(videoPublication);
  const isScreenShareEnabled = publications.find(p => isScreenShareName(p.trackName));

  const videoTrack = useTrack(videoPublication);
  const isVideoSwitchedOff = useIsTrackSwitchedOff(videoTrack as LocalVideoTrack | RemoteVideoTrack);

  const audioTrack = useTrack(audioPublication) as LocalAudioTrack | RemoteAudioTrack | undefined;
  const isParticipantReconnecting = useParticipantIsReconnecting(participant);

  const { isGalleryViewActive } = useAppState();

  const classes = useStyles();

  const isHandRaised = useRaisedHand(participant.identity);

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
        {attention && (
          <>
            {attention.multiface && (
              <span
                className={classes.multifacePill}
                title="Múltiples rostros detectados"
                data-testid="participant-multiface-flag"
              >
                Multi-rostro
              </span>
            )}
            {/* Suppress the (stale) attention level badge while the camera is off.
                The tile already shows the avatar placeholder natively. */}
            {!attention.cameraOff && (
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
        {isHandRaised && (
          <span
            className={classes.raisedHandBadge}
            data-testid="participant-raised-hand"
            title="Mano levantada"
            aria-label="Mano levantada"
          >
            <PanToolIcon style={{ color: '#1f2937', fontSize: 16 }} />
          </span>
        )}
      </div>
      <div className={classes.innerContainer}>
        {(!isVideoEnabled || isVideoSwitchedOff) && (
          <div className={classes.avatarContainer}>
            <AvatarIcon />
          </div>
        )}
        {isParticipantReconnecting && (
          <div className={classes.reconnectingContainer}>
            <Typography variant="body1" className={classes.typography}>
              Reconnecting...
            </Typography>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
