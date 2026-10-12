import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { LocalAudioTrack, LocalVideoTrack, Participant, RemoteAudioTrack, RemoteVideoTrack } from 'twilio-video';

import AudioLevelIndicator from '../AudioLevelIndicator/AudioLevelIndicator';
import AvatarIcon from '../../icons/AvatarIcon';
import PanToolIcon from '@material-ui/icons/PanTool';
import NetworkQualityLevel from '../NetworkQualityLevel/NetworkQualityLevel';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';

import useIsRecording from '../../hooks/useIsRecording/useIsRecording';
import useIsTrackSwitchedOff from '../../hooks/useIsTrackSwitchedOff/useIsTrackSwitchedOff';
import useParticipantIsReconnecting from '../../hooks/useParticipantIsReconnecting/useParticipantIsReconnecting';
import usePublications from '../../hooks/usePublications/usePublications';
import useScreenShareParticipant from '../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useTrack from '../../hooks/useTrack/useTrack';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { useRaisedHand } from '../../hooks/useRaiseHand/raisedHandsContext';
import { isTeacherIdentity, stripTeacherSuffix } from '../PreJoinScreens/classSessionTypes';
import RoleBadge from '../RoleBadge/RoleBadge';
import { isScreenShareName } from '../../utils/trackSelectors';

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
  // Raised-hand badge — bottom-right corner of the main tile when this participant raised their hand.
  raisedHandBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    lineHeight: 1,
    boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
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

  const publications = usePublications(participant);
  const videoPublication = publications.find(p => !isScreenShareName(p.trackName) && p.kind === 'video');
  const screenSharePublication = publications.find(p => isScreenShareName(p.trackName));

  const videoTrack = useTrack(screenSharePublication || videoPublication);
  const isVideoEnabled = Boolean(videoTrack);

  const audioPublication = publications.find(p => p.kind === 'audio');
  const audioTrack = useTrack(audioPublication) as LocalAudioTrack | RemoteAudioTrack | undefined;

  const isVideoSwitchedOff = useIsTrackSwitchedOff(videoTrack as LocalVideoTrack | RemoteVideoTrack);
  const isParticipantReconnecting = useParticipantIsReconnecting(participant);

  const isRecording = useIsRecording();

  const isHandRaised = useRaisedHand(participant.identity);

  return (
    <div
      data-cy-main-participant
      data-cy-participant={participant.identity}
      className={clsx(classes.container, {
        [classes.fullWidth]: !isRemoteParticipantScreenSharing,
      })}
    >
      <div className={classes.infoContainer}>
        <div style={{ display: 'flex' }}>
          <div className={classes.identity}>
            <AudioLevelIndicator audioTrack={audioTrack} />
            <Typography variant="body1" color="inherit">
              {stripTeacherSuffix(participant.identity)}
              {isLocal && ' (Yo)'}
              {screenSharePublication && ' - Screen'}
            </Typography>
            {isTeacherIdentity(participant.identity) && <RoleBadge size="sm" className={classes.roleBadge} />}
          </div>
          <NetworkQualityLevel participant={participant} />
        </div>
        {isRecording && (
          <Tooltip
            title="All participants' audio and video is currently being recorded. Visit the app settings to stop recording."
            placement="top"
          >
            <div className={classes.recordingIndicator}>
              <div className={classes.circle}></div>
              <Typography variant="body1" color="inherit" data-cy-recording-indicator>
                Recording
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
      {isParticipantReconnecting && (
        <div className={classes.reconnectingContainer}>
          <Typography variant="body1" style={{ color: 'white' }}>
            Reconnecting...
          </Typography>
        </div>
      )}
      {isHandRaised && (
        <span
          className={classes.raisedHandBadge}
          data-testid="participant-raised-hand"
          title="Mano levantada"
          aria-label="Mano levantada"
        >
          <PanToolIcon style={{ color: '#1f2937', fontSize: 22 }} />
        </span>
      )}
      {children}
    </div>
  );
}
