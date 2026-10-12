import { renderHook } from '@testing-library/react-hooks';
import useRecordingToggle from './useRecordingToggle';
import { useAppState } from '../../state';
import useIsRecording from '../useIsRecording/useIsRecording';
import useVideoContext from '../useVideoContext/useVideoContext';

jest.mock('../../state');
jest.mock('../useIsRecording/useIsRecording');
jest.mock('../useVideoContext/useVideoContext');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseIsRecording = useIsRecording as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const updateRecordingRules = jest.fn();

describe('the useRecordingToggle hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVideoContext.mockReturnValue({ room: { sid: 'RM1' } });
    mockUseIsRecording.mockReturnValue(false);
    mockUseAppState.mockReturnValue({ updateRecordingRules, isFetching: false, roomType: 'group' });
  });

  it('starts recording by including every track when stopped', () => {
    renderHook(() => useRecordingToggle()).result.current.toggle();
    expect(updateRecordingRules).toHaveBeenCalledWith('RM1', [{ type: 'include', all: true }]);
  });

  it('stops recording by excluding every track while recording', () => {
    mockUseIsRecording.mockReturnValue(true);
    const { result } = renderHook(() => useRecordingToggle());

    expect(result.current.isRecording).toBe(true);
    result.current.toggle();
    expect(updateRecordingRules).toHaveBeenCalledWith('RM1', [{ type: 'exclude', all: true }]);
  });

  it.each([
    ['group', true],
    ['small-group', true],
    ['peer-to-peer', false],
    ['go', false],
  ])('is supported for a %s room: %s', (roomType, supported) => {
    mockUseAppState.mockReturnValue({ updateRecordingRules, isFetching: false, roomType });
    expect(renderHook(() => useRecordingToggle()).result.current.supported).toBe(supported);
  });

  it('reports a rules request in flight as busy', () => {
    mockUseAppState.mockReturnValue({ updateRecordingRules, isFetching: true, roomType: 'group' });
    expect(renderHook(() => useRecordingToggle()).result.current.busy).toBe(true);
  });
});
