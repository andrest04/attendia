import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import Participant from '../../Participant/Participant';
import useMainParticipant from '../../../hooks/useMainParticipant/useMainParticipant';
import useParticipantsContext from '../../../hooks/useParticipantsContext/useParticipantsContext';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import useSelectedParticipant from '../../VideoProvider/useSelectedParticipant/useSelectedParticipant';
import useScreenShareParticipant from '../../../hooks/useScreenShareParticipant/useScreenShareParticipant';

// Tile dimensions: 16:9 aspect ratio, ~120px tall.
const TILE_HEIGHT = 120;
const TILE_WIDTH = Math.round(TILE_HEIGHT * (16 / 9)); // 213px

const useStyles = makeStyles(() => ({
  strip: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    // justify-content: center clips the left edge once the row overflows (the
    // overflowed start becomes unscrollable); auto margins on the edge tiles
    // center the row when it fits and degrade to a normal scroll row when not.
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
    '& > :first-child': {
      marginLeft: 'auto',
    },
    '& > :last-child': {
      marginRight: 'auto',
    },
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
 * Participant ordering and hide logic mirror ParticipantList exactly:
 *   - local participant is always first
 *   - remote participants follow in speakerViewParticipants order
 *   - a remote participant whose tile is already shown as the main participant
 *     is hidden (hideParticipant=true) — unless they are selected or screen-sharing
 *
 * Returns null when there are no remote participants (same guard as ParticipantList).
 */
export default function ParticipantStrip() {
  const classes = useStyles();
  const { room } = useVideoContext();
  const localParticipant = room!.localParticipant;
  const { speakerViewParticipants } = useParticipantsContext();
  const [selectedParticipant, setSelectedParticipant] = useSelectedParticipant();
  const screenShareParticipant = useScreenShareParticipant();
  const mainParticipant = useMainParticipant();

  // Match ParticipantList: don't render when there are no remote participants.
  if (speakerViewParticipants.length === 0) return null;

  return (
    <div className={classes.strip} data-testid="participant-strip">
      {/* Local participant is always the first tile */}
      <div className={classes.tile}>
        <Participant participant={localParticipant} isLocalParticipant={true} />
      </div>

      {speakerViewParticipants.map(participant => {
        const isSelected = participant === selectedParticipant;
        // Mirror ParticipantList hide logic exactly:
        // hide a participant that is already shown as the main participant,
        // unless they are selected by the user or they are screen-sharing.
        const hideParticipant =
          participant === mainParticipant && participant !== screenShareParticipant && !isSelected;
        return (
          <div key={participant.sid} className={clsx(classes.tile, { [classes.tileHidden]: hideParticipant })}>
            <Participant
              participant={participant}
              isSelected={isSelected}
              onClick={() => setSelectedParticipant(participant)}
              hideParticipant={hideParticipant}
            />
          </div>
        );
      })}
    </div>
  );
}
