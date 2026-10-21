import React from 'react';
import { makeStyles } from '@material-ui/core';
import OverflowMenu from '../ToolbarParts/OverflowMenu';
import { buildStudentModerationItems, StudentModerationHandlers } from './studentModerationItems';

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
}));

interface TileModerationMenuProps {
  identity: string;
  handlers: StudentModerationHandlers;
}

/** The three-dots moderation menu on a student's video tile (teacher viewers only). */
export default function TileModerationMenu({ identity, handlers }: TileModerationMenuProps) {
  const classes = useStyles();
  const testIdPrefix = `participant-moderation-${identity}`;
  const items = buildStudentModerationItems(identity, handlers, testIdPrefix);
  if (items.length === 0) return null;
  return (
    <div className={classes.wrap} onClick={event => event.stopPropagation()}>
      <OverflowMenu items={items} testIdPrefix={testIdPrefix} chipClassName={classes.chip} />
    </div>
  );
}
