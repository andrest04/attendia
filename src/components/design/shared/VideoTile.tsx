import React from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import VideocamIcon from '@material-ui/icons/Videocam';
import WarningIcon from '@material-ui/icons/Warning';
import WifiIcon from '@material-ui/icons/Wifi';
import SignalWifiOffIcon from '@material-ui/icons/SignalWifiOff';

import USTag from '../USTag';
import { wf } from '../wireframe';
import { ConnectionQuality, AttentionLevel } from '../data';

/** Badge fill per attention level — mirrors the reference's `attentionFill`. */
const attentionFill: Record<AttentionLevel, string> = {
  high: wf.gray700,
  medium: wf.gray500,
  low: wf.gray300,
};

const attentionLabel: Record<AttentionLevel, string> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: wf.gray300,
      border: `1px solid ${wf.gray500}`,
      borderRadius: 4,
      overflow: 'hidden',
    },
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    screenGlyph: { width: 64, height: 48, backgroundColor: wf.gray500, borderRadius: 4 },
    screenText: { fontSize: 11, color: wf.gray700 },
    cameraText: { fontSize: 12, color: wf.gray500 },
    bottomBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 8px',
      backgroundColor: wf.gray700,
      minHeight: 28,
    },
    name: {
      fontSize: 11,
      color: wf.bg,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '60%',
    },
    badges: { display: 'flex', alignItems: 'center', gap: 4 },
    attentionBadge: {
      fontSize: 9,
      padding: '1px 4px',
      borderRadius: 2,
    },
    twilio: { fontSize: 8, color: wf.gray500, fontStyle: 'italic' },
    proctoring: {
      position: 'absolute',
      top: 4,
      right: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '1px 4px',
      backgroundColor: wf.gray700,
      borderRadius: 4,
    },
    proctoringText: { fontSize: 9, color: wf.bg },
  })
);

interface VideoTileProps {
  name?: string;
  height?: number;
  showTwilio?: boolean;
  attentionLevel?: AttentionLevel | null;
  showProctoringAlert?: boolean;
  connectionQuality?: ConnectionQuality;
  isScreenShare?: boolean;
  isLarge?: boolean;
  className?: string;
}

/** Participant video placeholder tile (name, attention badge, connection, proctoring alert). Design mock. */
export default function VideoTile({
  name = 'Participante',
  height = 180,
  showTwilio = true,
  attentionLevel = null,
  showProctoringAlert = false,
  connectionQuality = 'strong',
  isScreenShare = false,
  isLarge = false,
  className,
}: VideoTileProps) {
  const classes = useStyles();

  return (
    <div className={className ? `${classes.root} ${className}` : classes.root} style={{ height }}>
      <div className={classes.body}>
        {isScreenShare ? (
          <>
            <div className={classes.screenGlyph} />
            <span className={classes.screenText}>Pantalla compartida</span>
          </>
        ) : (
          <>
            <VideocamIcon style={{ fontSize: isLarge ? 40 : 24, color: wf.gray500 }} />
            {isLarge && <span className={classes.cameraText}>Vista de cámara</span>}
          </>
        )}
      </div>

      <div className={classes.bottomBar}>
        <span className={classes.name}>{name}</span>
        <div className={classes.badges}>
          {attentionLevel && (
            <span
              className={classes.attentionBadge}
              style={{
                backgroundColor: attentionFill[attentionLevel],
                color: attentionLevel === 'low' ? wf.gray700 : wf.bg,
              }}
            >
              {attentionLabel[attentionLevel]}
            </span>
          )}
          {connectionQuality === 'weak' ? (
            <SignalWifiOffIcon style={{ fontSize: 12, color: wf.bg }} />
          ) : (
            <WifiIcon style={{ fontSize: 12, color: connectionQuality === 'strong' ? wf.bg : wf.gray500 }} />
          )}
          {showTwilio && <span className={classes.twilio}>Twilio</span>}
        </div>
      </div>

      {showProctoringAlert && (
        <div className={classes.proctoring}>
          <WarningIcon style={{ fontSize: 10, color: wf.bg }} />
          <span className={classes.proctoringText}>Multi-rostro</span>
        </div>
      )}
    </div>
  );
}

interface CompactTileProps {
  name: string;
  attentionLevel?: AttentionLevel | null;
  showProctoringAlert?: boolean;
  usIds?: string[];
}

/** Compact tile wrapper for the gallery grid: a fixed-height `VideoTile` plus an optional US annotation. */
export function CompactVideoTile({ name, attentionLevel, showProctoringAlert, usIds }: CompactTileProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <VideoTile
        name={name}
        height={100}
        attentionLevel={attentionLevel}
        showProctoringAlert={showProctoringAlert}
        showTwilio
      />
      {usIds && <USTag ids={usIds} />}
    </div>
  );
}
