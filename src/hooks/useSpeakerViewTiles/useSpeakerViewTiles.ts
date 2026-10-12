import { Participant } from 'twilio-video';
import useMainParticipant from '../useMainParticipant/useMainParticipant';
import useParticipantsContext from '../useParticipantsContext/useParticipantsContext';
import useScreenShareParticipant from '../useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../useVideoContext/useVideoContext';
import useSelectedParticipant from '../../components/VideoProvider/useSelectedParticipant/useSelectedParticipant';

export interface SpeakerViewTile {
  participant: Participant;
  isSelected: boolean;
  /**
   * The participant is already shown as the main participant. Their tile stays mounted (track
   * subscriptions intact) but is hidden — unless they are selected or sharing their screen.
   */
  hidden: boolean;
  select: () => void;
}

/**
 * The tiles of the speaker-view sidebar/filmstrip, in display order: the local participant is
 * always drawn first by the caller, then these remote tiles. ParticipantList (legacy sidebar)
 * and ParticipantStrip (desktop shells) used to carry mirrored copies of this logic.
 */
export default function useSpeakerViewTiles() {
  const { room } = useVideoContext();
  const localParticipant = room!.localParticipant;
  const { speakerViewParticipants } = useParticipantsContext();
  const [selectedParticipant, setSelectedParticipant] = useSelectedParticipant();
  const screenShareParticipant = useScreenShareParticipant();
  const mainParticipant = useMainParticipant();

  const tiles: SpeakerViewTile[] = speakerViewParticipants.map(participant => {
    const isSelected = participant === selectedParticipant;
    return {
      participant,
      isSelected,
      hidden: participant === mainParticipant && participant !== screenShareParticipant && !isSelected,
      select: () => setSelectedParticipant(participant),
    };
  });

  return {
    localParticipant,
    tiles,
    /** Someone other than the local participant is sharing their screen. */
    isRemoteParticipantScreenSharing: Boolean(screenShareParticipant && screenShareParticipant !== localParticipant),
  };
}
