import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { Participant } from 'twilio-video';

import AudioLevelIndicator from '../AudioLevelIndicator/AudioLevelIndicator';
import AvatarIcon from '../../icons/AvatarIcon';
import NetworkQualityLevel from '../NetworkQualityLevel/NetworkQualityLevel';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';

import useIsRecording from '../../hooks/useIsRecording/useIsRecording';
import useParticipantTile from '../../hooks/useParticipantTile/useParticipantTile';
import useScreenShareParticipant from '../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { isTeacherIdentity, stripTeacherSuffix } from '../../classSession/classSessionTypes';
import { useModerationActions } from '../Room/ModerationMenu/moderationActionsContext';
import TileModerationMenu from '../Room/ModerationMenu/TileModerationMenu';
import RoleBadge from '../RoleBadge/RoleBadge';
import RaisedHandBadge from '../ParticipantTileParts/RaisedHandBadge';
import ReconnectingOverlay from '../ParticipantTileParts/ReconnectingOverlay';
import { t } from '../../i18n/translate';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    // Fill the parent so the absolutely-positioned avatar/video (height:100%) have a
    // sized box. The legacy layout stretched this via its CSS grid cell; inside the
    // classroom shells' flex speaker stage nothing stretched it, so the tile collapsed
    // to height 0 and the avatar/video bled out the top.
    height: '100%',
    width: '100%',
  },
  identity: {
    background: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    padding: '0.1em 0.3em 0.1em 0',
    display: 'inline-flex',
    '& svg': {
      marginLeft: '0.3em',
    },
    marginRight: '0.4em',
    alignItems: 'center',
  },
  roleBadge: {
    marginLeft: '0.5em',
    alignSelf: 'center',
  },
  infoContainer: {
    position: 'absolute',
    zIndex: 2,
    height: '100%',
    width: '100%',
  },
  fullWidth: {
    gridArea: '1 / 1 / 2 / 3',
    [theme.breakpoints.down('sm')]: {
      gridArea: '1 / 1 / 3 / 3',
    },
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
    '& svg': {
      transform: 'scale(2)',
    },
  },
  recordingIndicator: {
    position: 'absolute',
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    padding: '0.1em 0.3em 0.1em 0',
    fontSize: '1.2rem',
    height: '28px',
    [theme.breakpoints.down('sm')]: {
      bottom: 'auto',
      right: 0,
      top: 0,
    },
  },
  circle: {
    height: '12px',
    width: '12px',
    background: 'red',
    borderRadius: '100%',
    margin: '0 0.6em',
    animation: `1.25s $pulsate ease-out infinite`,
  },
  '@keyframes pulsate': {
    '0%': {
      background: `#A90000`,
    },
    '50%': {
      background: '#f00',
    },
    '100%': {
      background: '#A90000',
    },
  },
}));

interface MainParticipantInfoProps {
  participant: Participant;
  children: React.ReactNode;
}

export default function MainParticipantInfo({ participant, children }: MainParticipantInfoProps) {
  const classes = useStyles();
  const { room } = useVideoContext();
  const localParticipant = room!.localParticipant;
  const isLocal = localParticipant === participant;

  const screenShareParticipant = useScreenShareParticipant();
  const isRemoteParticipantScreenSharing = screenShareParticipant && screenShareParticipant !== localParticipant;

  // The main stage shows the screen share in place of the camera when there is one.
  const {
    videoTrack,
    audioTrack,
    isSharingScreen,
    isVideoSwitchedOff,
    isReconnecting: isParticipantReconnecting,
    isHandRaised,
  } = useParticipantTile(participant, { preferScreenShare: true });
  const isVideoEnabled = Boolean(videoTrack);

  const isRecording = useIsRecording();
  // Teachers only (provided by Room); never on the local participant's own stage.
  const moderationActions = useModerationActions();

  return (
    <div
      data-cy-main-participant
      data-cy-participant={participant.identity}
      className={clsx(classes.container, {
        [classes.fullWidth]: !isRemoteParticipantScreenSharing,
      })}
    >
      <div className={classes.infoContainer}>
        {moderationActions && !isLocal && (
          <TileModerationMenu identity={participant.identity} handlers={moderationActions} corner="right" />
        )}
        <div style={{ display: 'flex' }}>
          <div className={classes.identity}>
            <AudioLevelIndicator audioTrack={audioTrack} />
            <Typography variant="body1" color="inherit">
              {stripTeacherSuffix(participant.identity)}
              {isLocal && ' (Yo)'}
              {isSharingScreen && ' - Screen'}
            </Typography>
            {isTeacherIdentity(participant.identity) && <RoleBadge size="sm" className={classes.roleBadge} />}
          </div>
          <NetworkQualityLevel participant={participant} />
        </div>
        {isRecording && (
          <Tooltip
            title={t(
              'Se está grabando el audio y el video de todos los participantes. Ve a la configuración de la app para detener la grabación.'
            )}
            placement="top"
          >
            <div className={classes.recordingIndicator}>
              <div className={classes.circle}></div>
              <Typography variant="body1" color="inherit" data-cy-recording-indicator>
                {t('Grabando')}
              </Typography>
            </div>
          </Tooltip>
        )}
      </div>
      {(!isVideoEnabled || isVideoSwitchedOff) && (
        <div className={classes.avatarContainer}>
          <AvatarIcon />
        </div>
      )}
      {isParticipantReconnecting && <ReconnectingOverlay />}
      {isHandRaised && <RaisedHandBadge size="stage" />}
      {children}
    </div>
  );
}
