import { ParticipantContext } from '../../components/ParticipantProvider';
import useRequiredContext from '../useRequiredContext/useRequiredContext';

export default function useParticipantContext() {
  return useRequiredContext(ParticipantContext, 'useParticipantContext', 'a ParticipantProvider');
}
