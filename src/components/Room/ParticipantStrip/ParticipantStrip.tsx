import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import Participant from '../../Participant/Participant';
import useSpeakerViewTiles from '../../../hooks/useSpeakerViewTiles/useSpeakerViewTiles';

// Tile dimensions: 16:9 aspect ratio, ~120px tall.
const TILE_HEIGHT = 120;
const TILE_WIDTH = Math.round(TILE_HEIGHT * (16 / 9)); // 213px

const useStyles = makeStyles(() => ({
  strip: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    // `safe center` centers the tiles when the row fits and degrades to a normal
    // scroll row (start-aligned, no clipped/unreachable left edge) when it overflows.
    // The earlier first/last-child `margin: auto` trick mis-centered whenever the
    // edge tile was `display:none` (the hidden main participant): `:last-child`
    // still matched the invisible tile, so the visible tile was pushed to one side.
    justifyContent: 'safe center',
    overflowX: 'auto',
    overflowY: 'hidden',
    backgroundColor: '#121C2D',
    gap: 8,
    padding: '8px 12px',
    // Hide scrollbar chrome while keeping scrollability.
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
    flexShrink: 0,
  },
  // Keeps the Participant mounted (track subscriptions intact) while removing
  // the fixed-size wrapper from the layout — without this, a hidden main
  // participant leaves a blank 213px gap in the strip.
  tileHidden: {
    display: 'none',
  },
  tile: {
    // Fixed dimensions so tiles don't stretch/shrink inside the flex row.
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    flexShrink: 0,
  },
}));

/**
 * ParticipantStrip renders a horizontal row of camera tiles for the speaker-view
 * stage in the desktop classroom shells (professor + student).
 *
 * Participant ordering and hide logic are shared with ParticipantList (useSpeakerViewTiles):
 *   - local participant is always first
 *   - remote participants follow in speakerViewParticipants order
 *   - a remote participant whose tile is already shown as the main participant
 *     is hidden (hideParticipant=true) — unless they are selected or screen-sharing
 *
 * Returns null when there are no remote participants (same guard as ParticipantList).
 */
export default function ParticipantStrip() {
  const classes = useStyles();
  const { localParticipant, tiles } = useSpeakerViewTiles();

  // Match ParticipantList: don't render when there are no remote participants.
  if (tiles.length === 0) return null;

  return (
    <div className={classes.strip} data-testid="participant-strip">
      {/* Local participant is always the first tile */}
      <div className={classes.tile}>
        <Participant participant={localParticipant} isLocalParticipant={true} />
      </div>

      {tiles.map(({ participant, isSelected, hidden, select }) => (
        <div key={participant.sid} className={clsx(classes.tile, { [classes.tileHidden]: hidden })}>
          <Participant participant={participant} isSelected={isSelected} onClick={select} hideParticipant={hidden} />
        </div>
      ))}
    </div>
  );
}
