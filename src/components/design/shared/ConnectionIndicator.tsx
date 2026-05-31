import React from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import WifiIcon from '@material-ui/icons/Wifi';
import WifiOffIcon from '@material-ui/icons/WifiOff';

import USTag from '../USTag';
import { wf } from '../wireframe';
import { ConnectionQuality } from '../data';

const labels: Record<ConnectionQuality, string> = {
  strong: 'Conexión estable',
  medium: 'Conexión media',
  weak: 'Conexión débil',
};

const colors: Record<ConnectionQuality, string> = {
  strong: wf.gray700,
  medium: wf.gray500,
  weak: wf.gray500,
};

const useStyles = makeStyles(() =>
  createStyles({
    root: { display: 'flex', flexDirection: 'column' },
    chip: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 8px',
      backgroundColor: wf.bg,
      border: `1px solid ${wf.gray300}`,
      borderRadius: 4,
    },
    label: { fontSize: 11 },
    bars: { display: 'flex', alignItems: 'flex-end', gap: 2, marginLeft: 4 },
    bar: { width: 4, borderRadius: 2 },
  })
);

interface ConnectionIndicatorProps {
  quality?: ConnectionQuality;
  showLabel?: boolean;
  showUS?: boolean;
}

/** US11 — connection quality chip with signal bars. Design mock. */
export default function ConnectionIndicator({
  quality = 'strong',
  showLabel = true,
  showUS = false,
}: ConnectionIndicatorProps) {
  const classes = useStyles();
  const color = colors[quality];

  return (
    <div className={classes.root}>
      <div className={classes.chip}>
        {quality === 'weak' ? (
          <WifiOffIcon style={{ fontSize: 14, color }} />
        ) : (
          <WifiIcon style={{ fontSize: 14, color }} />
        )}
        {showLabel && (
          <span className={classes.label} style={{ color }}>
            {labels[quality]}
          </span>
        )}
        <div className={classes.bars}>
          <div className={classes.bar} style={{ height: 4, backgroundColor: wf.gray700 }} />
          <div
            className={classes.bar}
            style={{ height: 7, backgroundColor: quality !== 'weak' ? wf.gray700 : wf.gray300 }}
          />
          <div
            className={classes.bar}
            style={{ height: 10, backgroundColor: quality === 'strong' ? wf.gray700 : wf.gray300 }}
          />
        </div>
      </div>
      {showUS && <USTag ids={['US11']} />}
    </div>
  );
}
