import React from 'react';
import { Participant, Track } from 'twilio-video';
import Publication from '../Publication/Publication';
import usePublications from '../../hooks/usePublications/usePublications';
import { isScreenShareName } from '../../utils/trackSelectors';

interface ParticipantTracksProps {
  participant: Participant;
  videoOnly?: boolean;
  enableScreenShare?: boolean;
  videoPriority?: Track.Priority | null;
  isLocalParticipant?: boolean;
}

/*
 *  The object model for the Room object (found here: https://www.twilio.com/docs/video/migrating-1x-2x#object-model) shows
 *  that Participant objects have TrackPublications, and TrackPublication objects have Tracks.
 *
 *  The React components in this application follow the same pattern. This ParticipantTracks component renders Publications,
 *  and the Publication component renders Tracks.
 */

export default function ParticipantTracks({
  participant,
  videoOnly,
  enableScreenShare,
  videoPriority,
  isLocalParticipant,
}: ParticipantTracksProps) {
  const publications = usePublications(participant);

  // Data tracks (raise-hand, attention telemetry, etc.) are consumed through hooks,
  // not rendered here — Publication returns null for them. Drop them so they don't
  // occupy render slots or collide on the React key (multiple data tracks all key
  // to `publication.kind === 'data'`).
  const visiblePublications = publications.filter(p => p.kind !== 'data');

  let filteredPublications;

  if (enableScreenShare && visiblePublications.some(p => isScreenShareName(p.trackName))) {
    // When displaying a screenshare track is allowed, and a screen share track exists,
    // remove all video tracks without the name 'screen'.
    filteredPublications = visiblePublications.filter(p => isScreenShareName(p.trackName) || p.kind !== 'video');
  } else {
    // Else, remove all screenshare tracks
    filteredPublications = visiblePublications.filter(p => !isScreenShareName(p.trackName));
  }

  return (
    <>
      {filteredPublications.map(publication => (
        <Publication
          key={publication.trackSid ?? publication.trackName}
          publication={publication}
          participant={participant}
          isLocalParticipant={isLocalParticipant}
          videoOnly={videoOnly}
          videoPriority={videoPriority}
        />
      ))}
    </>
  );
}
