import React from 'react';
import { shallow } from 'enzyme';
import { renderHook } from '@testing-library/react-hooks';

import Room, { useSetSpeakerViewOnScreenShare } from './Room';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { useAppState } from '../../state';
import { useMediaQuery } from '@material-ui/core';
import useIsRecording from '../../hooks/useIsRecording/useIsRecording';
import useMainParticipant from '../../hooks/useMainParticipant/useMainParticipant';
import useParticipants from '../../hooks/useParticipants/useParticipants';
import useParticipantNetworkQualityLevel from '../../hooks/useParticipantNetworkQualityLevel/useParticipantNetworkQualityLevel';

jest.mock('swiper/react', () => ({
  Swiper: jest.fn(),
  SwiperSlide: jest.fn(),
}));

jest.mock('swiper', () => ({
  Pagination: jest.fn(),
}));

jest.mock('../../hooks/useChatContext/useChatContext');
jest.mock('../../hooks/useVideoContext/useVideoContext');
jest.mock('../../state');
jest.mock('../../hooks/useIsRecording/useIsRecording');
jest.mock('../../hooks/useMainParticipant/useMainParticipant');
jest.mock('../../hooks/useParticipants/useParticipants');
jest.mock('../../hooks/useParticipantNetworkQualityLevel/useParticipantNetworkQualityLevel');
jest.mock('@material-ui/core', () => {
  const actual = jest.requireActual('@material-ui/core');
  return { ...actual, useMediaQuery: jest.fn() };
});

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseChatContext = useChatContext as jest.Mock<any>;
const mockUseIsRecording = useIsRecording as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;
mockUseIsRecording.mockImplementation(() => false);
const mockUseMediaQuery = useMediaQuery as jest.Mock<any>;
const mockUseMainParticipant = useMainParticipant as jest.Mock<any>;
const mockUseParticipants = useParticipants as jest.Mock<any>;
const mockUseParticipantNetworkQualityLevel = useParticipantNetworkQualityLevel as jest.Mock<any>;

const mockToggleChatWindow = jest.fn();
const mockOpenBackgroundSelection = jest.fn();
mockUseChatContext.mockImplementation(() => ({
  isChatWindowOpen: false,
  setIsChatWindowOpen: mockToggleChatWindow,
}));
mockUseVideoContext.mockImplementation(() => ({
  setIsBackgroundSelectionOpen: mockOpenBackgroundSelection,
  isBackgroundSelectionOpen: false,
  room: { localParticipant: {} },
}));
mockUseAppState.mockImplementation(() => ({ isGalleryViewActive: false, setIsGalleryViewActive: jest.fn() }));
mockUseMediaQuery.mockImplementation(() => false);
mockUseMainParticipant.mockImplementation(() => ({ identity: 'profesor-demo' }));
mockUseParticipants.mockImplementation(() => [{ identity: 'student-a' }, { identity: 'student-b' }]);
mockUseParticipantNetworkQualityLevel.mockImplementation(() => null);

describe('the Room component', () => {
  it('should render correctly when the chat window and background selection windows are closed', () => {
    const wrapper = shallow(<Room />);
    expect(wrapper.prop('className')).not.toContain('rightDrawerOpen');
  });

  it('should render correctly with chat window open', () => {
    mockUseChatContext.mockImplementationOnce(() => ({
      isChatWindowOpen: true,
      setIsChatWindowOpen: jest.fn(),
    }));
    const wrapper = shallow(<Room />);
    expect(wrapper.prop('className')).not.toContain('rightDrawerOpen');
  });

  it('should render correctly with the background selection window open', () => {
    mockUseVideoContext.mockImplementationOnce(() => ({
      isBackgroundSelectionOpen: true,
      setIsBackgroundSelectionOpen: jest.fn(),
      room: { localParticipant: {} },
    }));
    const wrapper = shallow(<Room />);
    expect(wrapper.prop('className')).toContain('rightDrawerOpen');
  });

  it('should render correctly when gallery view is inactive', () => {
    mockUseVideoContext.mockImplementationOnce(() => ({
      isBackgroundSelectionOpen: true,
      setIsBackgroundSelectionOpen: jest.fn(),
      room: { localParticipant: {} },
    }));
    const wrapper = shallow(<Room />);
    const shell = wrapper.find('StudentRoomShell');
    expect(shell.exists()).toBe(true);
    expect(((shell.prop('stage') as React.ReactElement).type as Function).name).toBe('MainParticipant');
    expect(wrapper.find('ParticipantList').exists()).toBe(false);
    expect(wrapper.find('GalleryView').exists()).toBe(false);
  });

  it('should render correctly when gallery view is active', () => {
    mockUseVideoContext.mockImplementationOnce(() => ({
      isBackgroundSelectionOpen: true,
      setIsBackgroundSelectionOpen: jest.fn(),
      room: { localParticipant: {} },
    }));
    mockUseAppState.mockImplementationOnce(() => ({ isGalleryViewActive: true, setIsGalleryViewActive: jest.fn() }));
    const wrapper = shallow(<Room />);
    const shell = wrapper.find('StudentRoomShell');
    expect(shell.exists()).toBe(true);
    expect(((shell.prop('stage') as React.ReactElement).type as Function).name).toBe('GalleryView');
    expect(wrapper.find('MainParticipant').exists()).toBe(false);
    expect(wrapper.find('ParticipantList').exists()).toBe(false);
    expect(wrapper.find('GalleryView').exists()).toBe(false);
  });

  it('should preserve mobile speaker-view layout without shell rails', () => {
    mockUseMediaQuery.mockImplementationOnce(() => true);
    const wrapper = shallow(<Room />);
    expect(wrapper.find('MainParticipant').exists()).toBe(true);
    expect(wrapper.find('ParticipantList').exists()).toBe(true);
    expect(wrapper.find('StudentRoomShell').exists()).toBe(false);
  });

  it('should always render chat in the right rail without legacy drawer overlap', () => {
    const wrapper = shallow(<Room />);
    const shell = wrapper.find('StudentRoomShell');

    // rightTab and onRightTabChange props are gone — the shell always shows chat
    expect(shell.prop('rightTab')).toBeUndefined();
    expect(shell.prop('onRightTabChange')).toBeUndefined();
    expect(wrapper.prop('className')).not.toContain('rightDrawerOpen');
  });

  it('passes room context to shell with participant count including local participant', () => {
    const wrapper = shallow(<Room />);
    const shell = wrapper.find('StudentRoomShell');

    expect(shell.prop('activeSpeakerLabel')).toBe('profesor-demo');
    expect(shell.prop('sessionLabel')).toBe('Sesión Twilio en vivo');
    expect(shell.prop('participantCount')).toBe(3);
    expect(shell.prop('notifications')).toEqual([]);
  });

  it('shows degraded connectivity banner when local participant quality is 2 or lower', () => {
    mockUseParticipantNetworkQualityLevel.mockImplementationOnce(() => 2);
    const wrapper = shallow(<Room />);
    const shell = wrapper.find('StudentRoomShell');

    expect(shell.prop('isConnectivityDegraded')).toBe(true);
  });

  it('hides degraded connectivity banner when local participant quality is null', () => {
    mockUseParticipantNetworkQualityLevel.mockImplementationOnce(() => null);
    const wrapper = shallow(<Room />);
    const shell = wrapper.find('StudentRoomShell');

    expect(shell.prop('isConnectivityDegraded')).toBe(false);
  });

  it('renders without crashing when room is not available yet', () => {
    mockUseVideoContext.mockImplementationOnce(() => ({
      isBackgroundSelectionOpen: false,
      setIsBackgroundSelectionOpen: jest.fn(),
      room: null,
    }));

    const wrapper = shallow(<Room />);
    const shell = wrapper.find('StudentRoomShell');

    expect(shell.exists()).toBe(true);
    expect(shell.prop('isConnectivityDegraded')).toBe(false);
  });

  it('routes the local participant to the student shell when identity has no teacher suffix', () => {
    const wrapper = shallow(<Room />);

    expect(wrapper.find('StudentRoomShell').exists()).toBe(true);
    expect(wrapper.find('ProfessorRoomShell').exists()).toBe(false);
  });

  it('routes the local participant to the professor shell when identity carries the teacher suffix', () => {
    mockUseVideoContext.mockImplementationOnce(() => ({
      setIsBackgroundSelectionOpen: jest.fn(),
      isBackgroundSelectionOpen: false,
      room: { localParticipant: { identity: 'Andres Torres [Profesor]' } },
    }));

    const wrapper = shallow(<Room />);

    expect(wrapper.find('ProfessorRoomShell').exists()).toBe(true);
    expect(wrapper.find('StudentRoomShell').exists()).toBe(false);
  });
});

describe('the useSetSpeakerViewOnScreenShare hook', () => {
  const mockSetIsGalleryViewActive = jest.fn();
  beforeEach(jest.clearAllMocks);

  it('should not deactivate gallery view when there is no screen share participant', () => {
    renderHook(() =>
      useSetSpeakerViewOnScreenShare(undefined, { localParticipant: {} } as any, mockSetIsGalleryViewActive, true)
    );
    expect(mockSetIsGalleryViewActive).not.toBeCalled();
  });

  it('should deactivate gallery view when a remote participant shares their screen', () => {
    const { rerender } = renderHook(
      ({ screenShareParticipant }) =>
        useSetSpeakerViewOnScreenShare(
          screenShareParticipant,
          { localParticipant: {} } as any,
          mockSetIsGalleryViewActive,
          true
        ),
      { initialProps: { screenShareParticipant: undefined } }
    );
    expect(mockSetIsGalleryViewActive).not.toBeCalled();
    rerender({ screenShareParticipant: {} } as any);
    expect(mockSetIsGalleryViewActive).toBeCalledWith(false);
  });

  it('should reactivate gallery view when screenshare ends if gallery view was active before another participant started screensharing', () => {
    const { rerender } = renderHook(
      ({ screenShareParticipant }) =>
        useSetSpeakerViewOnScreenShare(
          screenShareParticipant,
          { localParticipant: {} } as any,
          mockSetIsGalleryViewActive,
          true
        ),
      { initialProps: { screenShareParticipant: undefined } }
    );
    expect(mockSetIsGalleryViewActive).not.toBeCalled();
    // screenshare starts
    rerender({ screenShareParticipant: {} } as any);
    expect(mockSetIsGalleryViewActive).toBeCalledWith(false);
    // screenshare ends
    rerender({ screenShareParticipant: undefined } as any);
    expect(mockSetIsGalleryViewActive).toBeCalledWith(true);
  });

  it('should not activate gallery view when screenshare ends if speaker view was active before another participant started screensharing', () => {
    const { rerender } = renderHook(
      ({ screenShareParticipant }) =>
        useSetSpeakerViewOnScreenShare(
          screenShareParticipant,
          { localParticipant: {} } as any,
          mockSetIsGalleryViewActive,
          false
        ),
      { initialProps: { screenShareParticipant: undefined } }
    );
    expect(mockSetIsGalleryViewActive).not.toBeCalled();
    // screenshare starts
    rerender({ screenShareParticipant: {} } as any);
    expect(mockSetIsGalleryViewActive).toBeCalledWith(false);
    // screenshare ends
    rerender({ screenShareParticipant: undefined } as any);
    // mockSetIsGalleryViewActive should only be called once with "false" since we're not reactivating gallery mode
    expect(mockSetIsGalleryViewActive).toBeCalledTimes(1);
  });

  it('should not activate speaker view when screenshare ends if it was active before screensharing, but the user switched to gallery view during the screenshare', () => {
    const mockScreenShareParticipant = {};
    const mockRoom = { localParticipant: {} } as any;

    const { rerender } = renderHook(
      ({ screenShareParticipant, isGalleryViewActive }) =>
        useSetSpeakerViewOnScreenShare(
          screenShareParticipant,
          mockRoom,
          mockSetIsGalleryViewActive,
          isGalleryViewActive
        ),
      { initialProps: { screenShareParticipant: undefined, isGalleryViewActive: false } }
    );

    expect(mockSetIsGalleryViewActive).not.toBeCalled();

    // start screenshare
    rerender({ screenShareParticipant: mockScreenShareParticipant, isGalleryViewActive: false } as any);
    expect(mockSetIsGalleryViewActive).toBeCalledWith(false);

    // enable gallery view
    rerender({ screenShareParticipant: mockScreenShareParticipant, isGalleryViewActive: true } as any);

    // stop screenshare
    rerender({ screenShareParticipant: undefined, isGalleryViewActive: true } as any);

    // mockSetIsGalleryViewActive should only be called once with "false" since we're not reactivating gallery view
    expect(mockSetIsGalleryViewActive).toBeCalledTimes(1);
  });

  it('should not deactivate gallery view when the local participant shares their screen', () => {
    const mockLocalParticipant = {};
    const { rerender } = renderHook(
      ({ screenShareParticipant }) =>
        useSetSpeakerViewOnScreenShare(
          screenShareParticipant,
          { localParticipant: mockLocalParticipant } as any,
          mockSetIsGalleryViewActive,
          true
        ),
      { initialProps: { screenShareParticipant: undefined } }
    );
    expect(mockSetIsGalleryViewActive).not.toBeCalled();
    rerender({ screenShareParticipant: mockLocalParticipant } as any);
    expect(mockSetIsGalleryViewActive).not.toBeCalled();
  });
});
