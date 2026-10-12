import { renderHook } from '@testing-library/react-hooks';
import useSpeakerViewTiles from './useSpeakerViewTiles';
import useMainParticipant from '../useMainParticipant/useMainParticipant';
import useParticipantsContext from '../useParticipantsContext/useParticipantsContext';
import useScreenShareParticipant from '../useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../useVideoContext/useVideoContext';
import useSelectedParticipant from '../../components/VideoProvider/useSelectedParticipant/useSelectedParticipant';

jest.mock('../useMainParticipant/useMainParticipant');
jest.mock('../useParticipantsContext/useParticipantsContext');
jest.mock('../useScreenShareParticipant/useScreenShareParticipant');
jest.mock('../useVideoContext/useVideoContext');
jest.mock('../../components/VideoProvider/useSelectedParticipant/useSelectedParticipant');

const mockUseMainParticipant = useMainParticipant as jest.Mock<any>;
const mockUseParticipantsContext = useParticipantsContext as jest.Mock<any>;
const mockUseScreenShareParticipant = useScreenShareParticipant as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseSelectedParticipant = useSelectedParticipant as jest.Mock<any>;

const local = { sid: 'local' } as any;
const ana = { sid: 'ana' } as any;
const bob = { sid: 'bob' } as any;
const setSelected = jest.fn();

describe('useSpeakerViewTiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVideoContext.mockImplementation(() => ({ room: { localParticipant: local } }));
    mockUseParticipantsContext.mockImplementation(() => ({ speakerViewParticipants: [ana, bob] }));
    mockUseSelectedParticipant.mockImplementation(() => [null, setSelected]);
    mockUseScreenShareParticipant.mockImplementation(() => undefined);
    mockUseMainParticipant.mockImplementation(() => ana);
  });

  it('returns the local participant and one tile per remote participant, in order', () => {
    const { result } = renderHook(() => useSpeakerViewTiles());

    expect(result.current.localParticipant).toBe(local);
    expect(result.current.tiles.map(tile => tile.participant)).toEqual([ana, bob]);
  });

  it('returns no tiles when there are no remote participants', () => {
    mockUseParticipantsContext.mockImplementation(() => ({ speakerViewParticipants: [] }));

    expect(renderHook(() => useSpeakerViewTiles()).result.current.tiles).toEqual([]);
  });

  it('hides the participant who is already the main participant', () => {
    const { tiles } = renderHook(() => useSpeakerViewTiles()).result.current;

    expect(tiles.map(tile => tile.hidden)).toEqual([true, false]);
  });

  it('keeps the main participant visible while they are selected', () => {
    mockUseSelectedParticipant.mockImplementation(() => [ana, setSelected]);

    const { tiles } = renderHook(() => useSpeakerViewTiles()).result.current;

    expect(tiles.map(tile => tile.isSelected)).toEqual([true, false]);
    expect(tiles.map(tile => tile.hidden)).toEqual([false, false]);
  });

  it('keeps the main participant visible while they share their screen', () => {
    mockUseScreenShareParticipant.mockImplementation(() => ana);

    expect(renderHook(() => useSpeakerViewTiles()).result.current.tiles.map(tile => tile.hidden)).toEqual([
      false,
      false,
    ]);
  });

  it('selects the participant of the tile', () => {
    renderHook(() => useSpeakerViewTiles()).result.current.tiles[1].select();

    expect(setSelected).toHaveBeenCalledWith(bob);
  });

  it('flags a screen share only when it comes from someone else', () => {
    expect(renderHook(() => useSpeakerViewTiles()).result.current.isRemoteParticipantScreenSharing).toBe(false);

    mockUseScreenShareParticipant.mockImplementation(() => local);
    expect(renderHook(() => useSpeakerViewTiles()).result.current.isRemoteParticipantScreenSharing).toBe(false);

    mockUseScreenShareParticipant.mockImplementation(() => bob);
    expect(renderHook(() => useSpeakerViewTiles()).result.current.isRemoteParticipantScreenSharing).toBe(true);
  });
});
