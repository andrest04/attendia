import { ParticipantAttention } from '../AttentionProvider/types';
import { classifyAttention } from '../AttentionProvider/presence';
import { ParticipantTileAttention } from '../ParticipantInfo/ParticipantInfo';

/**
 * What a gallery tile needs from a participant's attention row. `measured` comes from
 * classifyAttention (the single presence rule), so the tile shows a level badge only for a real
 * reading — never "Bajo" for a phone, a hidden face, a camera that is off or a reading that has
 * not arrived yet.
 */
export function toTileAttention(participant: ParticipantAttention): ParticipantTileAttention {
  return {
    level: participant.level,
    multiface: participant.multiface,
    measured: classifyAttention(participant) === 'measured',
  };
}
