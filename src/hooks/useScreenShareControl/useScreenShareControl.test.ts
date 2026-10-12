import { renderHook } from '@testing-library/react-hooks';
import useScreenShareControl from './useScreenShareControl';
import useVideoContext from '../useVideoContext/useVideoContext';
import useScreenShareParticipant from '../useScreenShareParticipant/useScreenShareParticipant';

jest.mock('../useVideoContext/useVideoContext');
jest.mock('../useScreenShareParticipant/useScreenShareParticipant');

const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseScreenShareParticipant = useScreenShareParticipant as jest.Mock<any>;
const toggleScreenShare = jest.fn();

const setSupport = (supported: boolean) =>
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: supported ? { getDisplayMedia: jest.fn() } : {},
  });

describe('the useScreenShareControl hook', () => {
  beforeEach(() => {
    setSupport(true);
    mockUseScreenShareParticipant.mockReturnValue(undefined);
    mockUseVideoContext.mockReturnValue({ toggleScreenShare, isSharingScreen: false });
  });

  it('is enabled when the browser supports it and nobody is sharing', () => {
    const { result } = renderHook(() => useScreenShareControl());
    expect(result.current).toMatchObject({ isSupported: true, blockedByOtherShare: false, disabled: false });
    expect(result.current.toggleScreenShare).toBe(toggleScreenShare);
  });

  it('is blocked while someone else is sharing', () => {
    mockUseScreenShareParticipant.mockReturnValue({ identity: 'ana' });
    const { result } = renderHook(() => useScreenShareControl());
    expect(result.current).toMatchObject({ blockedByOtherShare: true, disabled: true });
  });

  it('never blocks the local user from stopping their OWN share', () => {
    mockUseScreenShareParticipant.mockReturnValue({ identity: 'me' });
    mockUseVideoContext.mockReturnValue({ toggleScreenShare, isSharingScreen: true });
    const { result } = renderHook(() => useScreenShareControl());
    expect(result.current).toMatchObject({ isSharingScreen: true, blockedByOtherShare: false, disabled: false });
  });

  it('is disabled when the browser cannot share the screen', () => {
    setSupport(false);
    const { result } = renderHook(() => useScreenShareControl());
    expect(result.current).toMatchObject({ isSupported: false, disabled: true });
  });
});
