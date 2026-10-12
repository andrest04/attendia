import { renderHook } from '@testing-library/react-hooks';
import useParticipantTile from './useParticipantTile';
import useIsTrackSwitchedOff from '../useIsTrackSwitchedOff/useIsTrackSwitchedOff';
import useParticipantIsReconnecting from '../useParticipantIsReconnecting/useParticipantIsReconnecting';
import usePublications from '../usePublications/usePublications';
import useTrack from '../useTrack/useTrack';
import { useRaisedHand } from '../useRaiseHand/raisedHandsContext';

jest.mock('../useIsTrackSwitchedOff/useIsTrackSwitchedOff');
jest.mock('../useParticipantIsReconnecting/useParticipantIsReconnecting');
jest.mock('../usePublications/usePublications');
jest.mock('../useTrack/useTrack');
jest.mock('../useRaiseHand/raisedHandsContext', () => ({ useRaisedHand: jest.fn() }));

const mockUsePublications = usePublications as jest.Mock<any>;
const mockUseTrack = useTrack as jest.Mock<any>;
const mockUseIsTrackSwitchedOff = useIsTrackSwitchedOff as jest.Mock<any>;
const mockUseParticipantIsReconnecting = useParticipantIsReconnecting as jest.Mock<any>;
const mockUseRaisedHand = useRaisedHand as jest.Mock<any>;

const camera = { trackName: '', kind: 'video' };
const screen = { trackName: 'screen-123', kind: 'video' };
const audio = { trackName: 'mic', kind: 'audio' };
const participant = { identity: 'Ana' } as any;

describe('useParticipantTile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePublications.mockImplementation(() => [camera, audio]);
    mockUseTrack.mockImplementation((publication: any) => publication && { from: publication });
    mockUseIsTrackSwitchedOff.mockImplementation(() => false);
    mockUseParticipantIsReconnecting.mockImplementation(() => false);
    mockUseRaisedHand.mockImplementation(() => false);
  });

  it('exposes the camera and audio tracks of the participant', () => {
    const { result } = renderHook(() => useParticipantTile(participant));

    expect(result.current.videoTrack).toEqual({ from: camera });
    expect(result.current.audioTrack).toEqual({ from: audio });
    expect(result.current.hasVideoPublication).toBe(true);
    expect(result.current.isSharingScreen).toBe(false);
  });

  it('keeps showing the camera while sharing the screen unless the screen is preferred', () => {
    mockUsePublications.mockImplementation(() => [camera, screen, audio]);

    const { result } = renderHook(() => useParticipantTile(participant));

    expect(result.current.videoTrack).toEqual({ from: camera });
    expect(result.current.isSharingScreen).toBe(true);
  });

  it('shows the screen share instead of the camera when preferScreenShare is set', () => {
    mockUsePublications.mockImplementation(() => [camera, screen, audio]);

    const { result } = renderHook(() => useParticipantTile(participant, { preferScreenShare: true }));

    expect(result.current.videoTrack).toEqual({ from: screen });
  });

  it('falls back to the camera when the screen share is preferred but absent', () => {
    const { result } = renderHook(() => useParticipantTile(participant, { preferScreenShare: true }));

    expect(result.current.videoTrack).toEqual({ from: camera });
  });

  it('reports no video publication for a participant who only shares their screen', () => {
    mockUsePublications.mockImplementation(() => [screen]);

    const { result } = renderHook(() => useParticipantTile(participant));

    expect(result.current.hasVideoPublication).toBe(false);
    expect(result.current.videoTrack).toBeUndefined();
  });

  it('reports the switched-off, reconnecting and raised-hand state of the participant', () => {
    mockUseIsTrackSwitchedOff.mockImplementation(() => true);
    mockUseParticipantIsReconnecting.mockImplementation(() => true);
    mockUseRaisedHand.mockImplementation(() => true);

    const { result } = renderHook(() => useParticipantTile(participant));

    expect(result.current).toMatchObject({ isVideoSwitchedOff: true, isReconnecting: true, isHandRaised: true });
    expect(mockUseParticipantIsReconnecting).toHaveBeenCalledWith(participant);
    expect(mockUseRaisedHand).toHaveBeenCalledWith('Ana');
    expect(mockUseIsTrackSwitchedOff).toHaveBeenCalledWith({ from: camera });
  });
});
