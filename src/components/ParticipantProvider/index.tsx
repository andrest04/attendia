import React, { createContext, useMemo } from 'react';
import { RemoteParticipant } from 'twilio-video';
import useGalleryViewParticipants from '../../hooks/useGalleryViewParticipants/useGalleryViewParticipants';
import useSpeakerViewParticipants from '../../hooks/useSpeakerViewParticipants/useSpeakerViewParticipants';
import { useRoomParticipants } from '../../hooks/useParticipants/useParticipants';
import { useRoomDominantSpeaker } from '../../hooks/useDominantSpeaker/useDominantSpeaker';
import { useRoomScreenShareParticipant } from '../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { RoomStateContext } from './roomStateContext';

/**
 * The purpose of the ParticipantProvider component is to ensure that the hooks useGalleryViewParticipants
 * and useSpeakerViewParticipants are not unmounted as users switch between Gallery View and Speaker View.
 * This will make sure that the ordering of the participants on the screen will remain so that the most
 * recent dominant speakers are always at the front of the list.
 *
 * It also owns the room's roster, dominant speaker and screen-share participant (see
 * roomStateContext.ts): subscribed once here, then read by every component through the
 * ordinary hooks instead of each attaching its own listeners to the room.
 */

export interface IParticipantContext {
  mobileGalleryViewParticipants: RemoteParticipant[];
  galleryViewParticipants: RemoteParticipant[];
  speakerViewParticipants: RemoteParticipant[];
}

export const ParticipantContext = createContext<IParticipantContext>(null!);

// Rendered inside RoomStateContext, so the ordering hooks below read the shared dominant
// speaker instead of subscribing to the room themselves.
const OrderedParticipantsProvider: React.FC = ({ children }) => {
  const mobileGalleryViewParticipants = useGalleryViewParticipants(true);
  const galleryViewParticipants = useGalleryViewParticipants();
  const speakerViewParticipants = useSpeakerViewParticipants();

  return (
    <ParticipantContext.Provider
      value={{
        mobileGalleryViewParticipants,
        galleryViewParticipants,
        speakerViewParticipants,
      }}
    >
      {children}
    </ParticipantContext.Provider>
  );
};

export const ParticipantProvider: React.FC = ({ children }) => {
  const { room } = useVideoContext();
  const participants = useRoomParticipants(room);
  const dominantSpeaker = useRoomDominantSpeaker(room);
  const screenShareParticipant = useRoomScreenShareParticipant(room);

  const roomState = useMemo(() => ({ participants, dominantSpeaker, screenShareParticipant }), [
    participants,
    dominantSpeaker,
    screenShareParticipant,
  ]);

  return (
    <RoomStateContext.Provider value={roomState}>
      <OrderedParticipantsProvider>{children}</OrderedParticipantsProvider>
    </RoomStateContext.Provider>
  );
};
