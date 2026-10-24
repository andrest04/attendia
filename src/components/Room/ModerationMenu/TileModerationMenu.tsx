import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core';
import useRemoteMedia from '../../../hooks/useRemoteMedia/useRemoteMedia';
import OverflowMenu from '../ToolbarParts/OverflowMenu';
import { buildModerationItemsForTarget, StudentModerationHandlers } from './studentModerationItems';

const useStyles = makeStyles(() => ({
  // Small translucent circle in the tile's top-left corner, above the video.
  chip: {
    minWidth: 0,
    width: 28,
    height: 28,
    padding: 0,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    '& .MuiButton-startIcon': { margin: 0 },
  },
  wrap: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 3,
  },
  wrapRight: {
    left: 'auto',
    right: 8,
  },
}));

interface TileModerationMenuProps {
  identity: string;
  handlers: StudentModerationHandlers;
  /** Corner of the tile; the main stage keeps its name/network row on the left, so it uses `right`. */
  corner?: 'left' | 'right';
}

/** The three-dots moderation menu on a remote tile (teacher viewers only; items follow `canModerate`). */
export default function TileModerationMenu({ identity, handlers, corner = 'left' }: TileModerationMenuProps) {
  const classes = useStyles();
  const testIdPrefix = `participant-moderation-${identity}`;
  const media = useRemoteMedia(identity);
  const items = buildModerationItemsForTarget({ identity, isLocal: false, media }, handlers, testIdPrefix);
  if (items.length === 0) return null;
  return (
    <div
      className={clsx(classes.wrap, { [classes.wrapRight]: corner === 'right' })}
      onClick={event => event.stopPropagation()}
    >
      <OverflowMenu items={items} testIdPrefix={testIdPrefix} chipClassName={classes.chip} />
    </div>
  );
}
