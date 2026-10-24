import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import PanToolIcon from '@material-ui/icons/PanTool';
import { t } from '../../i18n/translate';

const useStyles = makeStyles(() => ({
  badge: {
    position: 'absolute',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  tile: {
    bottom: 8,
    right: 8,
    zIndex: 4,
    width: 30,
    height: 30,
    fontSize: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
  },
  stage: {
    bottom: 12,
    right: 12,
    zIndex: 3,
    width: 40,
    height: 40,
    fontSize: 22,
    boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
  },
}));

const ICON_SIZE = { tile: 16, stage: 22 };

/**
 * The white hand badge in the bottom-right corner of the tile of whoever raised their hand.
 * `tile` is the small gallery/strip tile, `stage` the large main-stage tile.
 */
export default function RaisedHandBadge({ size }: { size: 'tile' | 'stage' }) {
  const classes = useStyles();
  return (
    <span
      className={clsx(classes.badge, classes[size])}
      data-testid="participant-raised-hand"
      title={t('Mano levantada')}
      aria-label={t('Mano levantada')}
    >
      <PanToolIcon style={{ color: '#1f2937', fontSize: ICON_SIZE[size] }} />
    </span>
  );
}
