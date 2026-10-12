import { ChatContext } from '../../components/ChatProvider';
import useRequiredContext from '../useRequiredContext/useRequiredContext';

export default function useChatContext() {
  return useRequiredContext(ChatContext, 'useChatContext', 'a ChatProvider');
}
