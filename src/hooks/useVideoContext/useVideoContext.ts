import { VideoContext } from '../../components/VideoProvider/videoContext';
import useRequiredContext from '../useRequiredContext/useRequiredContext';

export default function useVideoContext() {
  return useRequiredContext(VideoContext, 'useVideoContext', 'a VideoProvider');
}
