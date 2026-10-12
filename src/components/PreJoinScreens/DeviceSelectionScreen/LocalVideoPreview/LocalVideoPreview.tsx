import React from 'react';
import { Hidden, makeStyles, Theme, Typography } from '@material-ui/core';
import LocalAudioLevelIndicator from '../../../LocalAudioLevelIndicator/LocalAudioLevelIndicator';
import { LocalVideoTrack } from 'twilio-video';
import VideoTrack from '../../../VideoTrack/VideoTrack';
import useVideoContext from '../../../../hooks/useVideoContext/useVideoContext';
import { selectCameraTrack } from '../../../../utils/trackSelectors';

const useStyles = makeStyles((theme: Theme) => ({
  // Outer card: browser-window chrome + video area
  card: {
    borderRadius: 20,
    border: '1px solid #e2ecf9',
    overflow: 'hidden',
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    backgroundColor: '#ffffff',
  },
  // Browser-window title bar
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px 9px',
    backgroundColor: '#f0f5ff',
    borderBottom: '1px solid #e2ecf9',
  },
  trafficDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  titleBarLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Inter, sans-serif',
    marginLeft: 6,
  },
  // Video area — fixed 16:9 dark navy
  videoArea: {
    position: 'relative',
    height: 0,
    overflow: 'hidden',
    paddingTop: `${(9 / 16) * 100}%`,
    backgroundColor: '#0f1e45',
  },
  videoInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Avatar shown when camera is off
  avatarContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    background: 'linear-gradient(135deg, rgba(29,110,237,0.4) 0%, rgba(29,47,111,0.533) 100%)',
    border: '3px solid rgba(255,255,255,0.15)',
    boxShadow: '0px 0px 40px 0px rgba(29,110,237,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitials: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 800,
    fontSize: 26,
    color: '#ffffff',
    lineHeight: 1,
  },
  // "Cámara activa" pill shown below avatar (or identity bar when video is on)
  cameraChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 14px',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  cameraChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
    flexShrink: 0,
  },
  cameraChipLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter, sans-serif',
  },
  // Identity bar when video IS active (bottom of video)
  identityContainer: {
    position: 'absolute',
    bottom: 0,
    zIndex: 1,
  },
  identity: {
    background: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    padding: '0.18em 0.3em',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
  },
  // Controls bar below the video (mic + camera buttons)
  controls: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 40,
    padding: '21px 28px 20px',
    borderTop: '1px solid #e2ecf9',
    backgroundColor: '#ffffff',
  },
}));

function getInitials(identity: string): string {
  const parts = identity
    .replace(/\[Profesor\]/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function LocalVideoPreview({ identity, children }: { identity: string; children?: React.ReactNode }) {
  const classes = useStyles();
  const { localTracks } = useVideoContext();

  const videoTrack = selectCameraTrack(localTracks) as LocalVideoTrack;

  const hasVideo = Boolean(videoTrack);
  const initials = getInitials(identity);

  return (
    <div className={classes.card}>
      {/* Browser-window chrome bar */}
      <div className={classes.titleBar}>
        <div className={classes.trafficDot} style={{ backgroundColor: '#ef4444' }} />
        <div className={classes.trafficDot} style={{ backgroundColor: '#ffb800' }} />
        <div className={classes.trafficDot} style={{ backgroundColor: '#10b981' }} />
        <span className={classes.titleBarLabel}>Twilio Video · Vista previa</span>
      </div>

      {/* Video / avatar area */}
      <div className={classes.videoArea}>
        <div className={classes.videoInner}>
          {hasVideo ? (
            <VideoTrack track={videoTrack} isLocal />
          ) : (
            <div className={classes.avatarContainer}>
              <div className={classes.avatarCircle}>
                <span className={classes.avatarInitials}>{initials}</span>
              </div>
              <div className={classes.cameraChip}>
                <div className={classes.cameraChipDot} />
                <span className={classes.cameraChipLabel}>Cámara apagada</span>
              </div>
            </div>
          )}
        </div>

        {/* Identity bar only shown when video is active */}
        {hasVideo && (
          <div className={classes.identityContainer}>
            <span className={classes.identity}>
              <LocalAudioLevelIndicator />
              <Typography variant="body1" color="inherit" component="span">
                {identity}
              </Typography>
            </span>
          </div>
        )}
      </div>

      {/* Controls bar — real device toggle buttons passed in by the parent */}
      {children && (
        <Hidden smDown>
          <div className={classes.controls}>{children}</div>
        </Hidden>
      )}
    </div>
  );
}
