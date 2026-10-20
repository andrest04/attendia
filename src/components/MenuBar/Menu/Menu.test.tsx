import React from 'react';
import AboutDialog from '../../AboutDialog/AboutDialog';
import { Button, MenuItem } from '@material-ui/core';
import DeviceSelectionDialog from '../../DeviceSelectionDialog/DeviceSelectionDialog';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import FlipCameraIcon from '../../../icons/FlipCameraIcon';
import Menu from './Menu';
import MenuContainer from '@material-ui/core/Menu';
import MoreIcon from '@material-ui/icons/MoreVert';
import { shallow } from 'enzyme';
import { render, fireEvent, waitForElement } from '@testing-library/react';

import { useAppState } from '../../../state';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useFlipCameraToggle from '../../../hooks/useFlipCameraToggle/useFlipCameraToggle';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import useIsRecording from '../../../hooks/useIsRecording/useIsRecording';
import { useSessionEndApi } from '../../../hooks/useSessionEnd/sessionEndContext';
import useLocalVideoToggle from '../../../hooks/useLocalVideoToggle/useLocalVideoToggle';

jest.mock('../../../hooks/useFlipCameraToggle/useFlipCameraToggle');
jest.mock('@material-ui/core/useMediaQuery');
jest.mock('../../../state');
let mockLocalIdentity = 'Ana [Profesor]';
jest.mock('../../../hooks/useVideoContext/useVideoContext', () => () => ({
  localTracks: [],
  room: { sid: 'mockRoomSid', localParticipant: { identity: mockLocalIdentity } },
}));
jest.mock('../../../hooks/useIsRecording/useIsRecording');
jest.mock('../../../hooks/useChatContext/useChatContext');
jest.mock('../../../hooks/useSessionEnd/sessionEndContext');
jest.mock('../../../hooks/useLocalVideoToggle/useLocalVideoToggle');

const mockUseFlipCameraToggle = useFlipCameraToggle as jest.Mock<any>;
const mockUseMediaQuery = useMediaQuery as jest.Mock<boolean>;
const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseIsRecording = useIsRecording as jest.Mock<boolean>;
const mockUseChatContext = useChatContext as jest.Mock<any>;
const mockUseLocalVideoToggle = useLocalVideoToggle as jest.Mock<any>;

const mockUseSessionEndApi = useSessionEndApi as jest.Mock<any>;
const mockToggleChatWindow = jest.fn();
mockUseChatContext.mockImplementation(() => ({ setIsChatWindowOpen: mockToggleChatWindow }));
mockUseLocalVideoToggle.mockImplementation(() => [true, () => {}]);

describe('the Menu component', () => {
  let mockUpdateRecordingRules: jest.Mock<any>;
  let mockSetIsGalleryViewActive = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalIdentity = 'Ana [Profesor]';
  });

  beforeAll(() => {
    mockUpdateRecordingRules = jest.fn(() => Promise.resolve());
    mockUseAppState.mockImplementation(() => ({
      isFetching: false,
      updateRecordingRules: mockUpdateRecordingRules,
      roomType: 'group',
      setIsGalleryViewActive: mockSetIsGalleryViewActive,
    }));
    mockUseFlipCameraToggle.mockImplementation(() => ({
      flipCameraDisabled: false,
      flipCameraSupported: false,
    }));
  });

  describe('the recording button', () => {
    describe('while recording is in progress', () => {
      beforeAll(() => {
        mockUseIsRecording.mockImplementation(() => true);
      });

      it('should display "Stop Recording"', () => {
        const { getByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));

        expect(getByText('Detener grabación')).toBeTruthy();
      });

      it('should correctly update recording rules and display the snackbar when the user clicks on the Stop Recording button', () => {
        const { getByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));

        fireEvent.click(getByText('Detener grabación'));

        expect(mockUpdateRecordingRules).toHaveBeenCalledWith('mockRoomSid', [{ all: true, type: 'exclude' }]);
        waitForElement(() => getByText('You can view the recording in the Twilio Console'));
      });
    });

    describe('for a confirmed co-teacher', () => {
      afterEach(() => mockUseSessionEndApi.mockReset());

      it('should not render the recording button (recording is owner-only)', () => {
        mockUseSessionEndApi.mockImplementation(() => ({ isCoTeacher: true }));
        mockUseIsRecording.mockImplementation(() => false);
        const { getByText, queryByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));
        expect(queryByText('Iniciar grabación')).toBeNull();
      });
    });

    describe('for a student', () => {
      it('should not render the recording button', () => {
        mockLocalIdentity = 'student-bob';
        mockUseIsRecording.mockImplementation(() => false);
        const { getByText, queryByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));
        expect(queryByText('Iniciar grabación')).toBeNull();
      });
    });

    describe('while recording is not in progress', () => {
      beforeAll(() => {
        mockUseIsRecording.mockImplementation(() => false);
      });

      it('should render the recording button in group rooms', () => {
        mockUseAppState.mockImplementation(() => ({
          isFetching: false,
          updateRecordingRules: mockUpdateRecordingRules,
          roomType: 'group',
          setIsGalleryViewActive: mockSetIsGalleryViewActive,
        }));
        const { getByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));
        expect(getByText('Iniciar grabación')).toBeTruthy();
      });

      it('should render the recording button in group-small rooms', () => {
        mockUseAppState.mockImplementation(() => ({
          isFetching: false,
          updateRecordingRules: mockUpdateRecordingRules,
          roomType: 'group-small',
          setIsGalleryViewActive: mockSetIsGalleryViewActive,
        }));
        const { getByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));
        expect(getByText('Iniciar grabación')).toBeTruthy();
      });

      it('should not render the recording button in go rooms', () => {
        mockUseAppState.mockImplementation(() => ({
          isFetching: false,
          updateRecordingRules: mockUpdateRecordingRules,
          roomType: 'go',
          setIsGalleryViewActive: mockSetIsGalleryViewActive,
        }));
        const { getByText, queryByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));
        expect(queryByText('Iniciar grabación')).toBeNull();
      });

      it('should not render the recording button in peer-to-peer rooms', () => {
        mockUseAppState.mockImplementation(() => ({
          isFetching: false,
          updateRecordingRules: mockUpdateRecordingRules,
          roomType: 'peer-to-peer',
          setIsGalleryViewActive: mockSetIsGalleryViewActive,
        }));
        const { getByText, queryByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));
        expect(queryByText('Iniciar grabación')).toBeNull();
      });

      it('should render the recording button when roomType is undefined', () => {
        mockUseAppState.mockImplementation(() => ({
          isFetching: false,
          updateRecordingRules: mockUpdateRecordingRules,
          roomType: undefined,
          setIsGalleryViewActive: mockSetIsGalleryViewActive,
        }));
        const { getByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));
        expect(getByText('Iniciar grabación')).toBeTruthy();
      });

      it('should display "Start Recording"', () => {
        const { getByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));

        expect(getByText('Iniciar grabación')).toBeTruthy();
      });

      it('should correctly update recording rules and display the snackbar when the user clicks on the Start Recording button', () => {
        const { getByText } = render(<Menu />);
        fireEvent.click(getByText('Más'));

        fireEvent.click(getByText('Iniciar grabación'));
        expect(mockUpdateRecordingRules).toHaveBeenCalledWith('mockRoomSid', [{ all: true, type: 'include' }]);
      });

      it('should disable the Start Recording button when isFetching is true', async () => {
        const appState = (isFetching: boolean) => () => ({
          isFetching,
          updateRecordingRules: mockUpdateRecordingRules,
          roomType: 'group',
          setIsGalleryViewActive: mockSetIsGalleryViewActive,
        });
        // The menu and the recording toggle each read the app state, so the mock must answer every call.
        mockUseAppState.mockImplementation(appState(true));
        try {
          const wrapper = shallow(<Menu />);

          expect(
            wrapper
              .find(MenuItem)
              .at(1)
              .prop('disabled')
          ).toBe(true);
        } finally {
          mockUseAppState.mockImplementation(appState(false));
        }
      });
    });
  });

  describe('on desktop devices', () => {
    beforeAll(() => {
      mockUseMediaQuery.mockImplementation(() => false);
      mockUseFlipCameraToggle.mockImplementation(() => ({
        flipCameraDisabled: false,
        flipCameraSupported: false,
      }));
    });

    it('should open the Menu when the Button is clicked', () => {
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(MenuContainer).prop('open')).toBe(false);
      wrapper.find(Button).simulate('click');
      expect(wrapper.find(MenuContainer).prop('open')).toBe(true);
    });

    it('should open the AboutDialog when the About button is clicked', () => {
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(AboutDialog).prop('open')).toBe(false);
      wrapper
        .find(MenuItem)
        .at(4)
        .simulate('click');
      expect(wrapper.find(AboutDialog).prop('open')).toBe(true);
    });

    it('should open the DeviceSelectionDialog when the Settings button is clicked', () => {
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(DeviceSelectionDialog).prop('open')).toBe(false);
      wrapper
        .find(MenuItem)
        .at(0)
        .simulate('click');
      expect(wrapper.find(DeviceSelectionDialog).prop('open')).toBe(true);
    });

    it('should show the Gallery View button when gallery view is inactive', () => {
      mockUseAppState.mockImplementation(() => ({
        setIsGalleryViewActive: mockSetIsGalleryViewActive,
        isGalleryViewActive: false,
      }));

      const { getByText } = render(<Menu />);
      fireEvent.click(getByText('Más'));
      fireEvent.click(getByText('Vista de galería'));

      expect(mockSetIsGalleryViewActive.mock.calls[0][0](false)).toBe(true);
    });

    it('should show the Speaker View button when gallery view is active', () => {
      mockUseAppState.mockImplementation(() => ({
        setIsGalleryViewActive: mockSetIsGalleryViewActive,
        isGalleryViewActive: true,
      }));

      const { getByText } = render(<Menu />);
      fireEvent.click(getByText('Más'));
      fireEvent.click(getByText('Vista de orador'));

      expect(mockSetIsGalleryViewActive.mock.calls[0][0](true)).toBe(false);
    });

    it('should render the correct icon', () => {
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(ExpandMoreIcon).exists()).toBe(true);
      expect(wrapper.find(MoreIcon).exists()).toBe(false);
    });

    it('should not render the Flip Camera button', () => {
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(FlipCameraIcon).exists()).toBe(false);
    });
  });

  describe('on mobile devices', () => {
    beforeAll(() => {
      mockUseMediaQuery.mockImplementation(() => true);
      mockUseFlipCameraToggle.mockImplementation(() => ({
        flipCameraDisabled: false,
        flipCameraSupported: true,
      }));
    });

    it('should render the correct icon', () => {
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(ExpandMoreIcon).exists()).toBe(false);
      expect(wrapper.find(MoreIcon).exists()).toBe(true);
    });

    it('should render non-disabled Flip Camera button when flipCameraSupported is true', () => {
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(FlipCameraIcon).exists()).toBe(true);
      expect(
        wrapper
          .find(MenuItem)
          .at(1)
          .prop('disabled')
      ).toBe(false);
    });

    it('should render a disabled Flip Camera button when flipCameraSupported is true, and flipCameraDisabled is true', () => {
      mockUseFlipCameraToggle.mockImplementationOnce(() => ({
        flipCameraDisabled: true,
        flipCameraSupported: true,
      }));
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(FlipCameraIcon).exists()).toBe(true);
      expect(
        wrapper
          .find(MenuItem)
          .at(1)
          .prop('disabled')
      ).toBe(true);
    });

    it('should not render Flip Camera button when flipCameraSupported is false', () => {
      mockUseFlipCameraToggle.mockImplementationOnce(() => ({
        flipCameraSupported: false,
      }));
      const wrapper = shallow(<Menu />);
      expect(wrapper.find(FlipCameraIcon).exists()).toBe(false);
    });
  });
});
