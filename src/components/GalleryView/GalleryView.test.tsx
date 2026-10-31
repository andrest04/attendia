import React from 'react';
import { GalleryView } from './GalleryView';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider, setI18n } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import testI18n from '../../i18n/testInit';
import useGalleryViewLayout from '../../hooks/useGalleryViewLayout/useGalleryViewLayout';
import { useAppState } from '../../state';
import { usePagination } from './usePagination/usePagination';
import { Participant } from '../Participant/Participant';
import { useModerationActions } from '../Room/ModerationMenu/moderationActionsContext';

const mockLocalParticipant = { identity: 'test-local-participant', sid: 0 };
const mockParticipants = [
  { identity: 'test-participant-1', sid: 1 },
  { identity: 'test-participant-2', sid: 2 },
  { identity: 'test-participant-3', sid: 3 },
  { identity: 'test-participant-4', sid: 4 },
];

jest.mock('../Participant/Participant', () => {
  const renderNothing = () => null;
  renderNothing.displayName = 'Participant';
  const MockParticipant = require('react').memo(renderNothing);
  return { __esModule: true, default: MockParticipant, Participant: MockParticipant };
});

jest.mock('../../constants', () => ({
  GALLERY_VIEW_ASPECT_RATIO: 9 / 16,
  GALLERY_VIEW_MARGIN: 3,
}));
jest.mock('../../hooks/useSpeakerViewParticipants/useSpeakerViewParticipants', () => () => mockParticipants);
jest.mock('../../hooks/useDominantSpeaker/useDominantSpeaker', () => () => null);
jest.mock('../../hooks/useVideoContext/useVideoContext', () => () => ({
  room: {
    localParticipant: mockLocalParticipant,
  },
}));

jest.mock('../../hooks/useParticipantsContext/useParticipantsContext', () => () => ({
  galleryViewParticipants: mockParticipants,
}));

jest.mock('../../hooks/useGalleryViewLayout/useGalleryViewLayout', () =>
  jest.fn(() => ({
    participantVideoWidth: 720,
    containerRef: { current: null },
  }))
);

jest.mock('./usePagination/usePagination', () => ({
  usePagination: jest.fn(() => ({
    currentPage: 2,
    totalPages: 4,
    setCurrentPage: jest.fn(),
    paginatedParticipants: [mockLocalParticipant, ...mockParticipants],
  })),
}));

jest.mock('../../state');
jest.mock('../Room/ModerationMenu/moderationActionsContext', () => ({
  useModerationActions: jest.fn(() => null),
}));

const mockUsePagination = usePagination as jest.Mock<any>;
const mockUseAppState = useAppState as jest.Mock<any>;

mockUseAppState.mockImplementation(() => ({ maxGalleryViewParticipants: 9 }));
const mockUseModerationActions = useModerationActions as jest.Mock<any>;

async function checkGalleryLocalization() {
    const i18n = createI18n({ detect: false, lng: 'es' });
    const originalIdentity = mockLocalParticipant.identity;
    mockLocalParticipant.identity = 'Profe [Profesor]';
    const wrapper = mount(<I18nextProvider i18n={i18n}><GalleryView /></I18nextProvider>);
    try {
      expect(wrapper.find('[data-testid="gallery-student-count"]').text()).toBe('Mostrando 4 / 4 estudiantes');
      expect(wrapper.find('button[aria-label="Página anterior"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Página siguiente"]').exists()).toBe(true);
      expect(wrapper.find('nav[aria-label="Navegación de páginas"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Página 2"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Ir a la página 3"]').exists()).toBe(true);
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.find('[data-testid="gallery-student-count"]').text()).toBe('Showing 4 / 4 students');
      expect(wrapper.find('button[aria-label="Previous page"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Next page"]').exists()).toBe(true);
      expect(wrapper.find('nav[aria-label="Page navigation"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Page 2"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Go to page 3"]').exists()).toBe(true);
      expect(wrapper.find(Participant).map(tile => tile.prop('participant'))).toEqual([mockLocalParticipant, ...mockParticipants]);
    } finally {
      wrapper.unmount();
      mockLocalParticipant.identity = originalIdentity;
      setI18n(testI18n);
    }
}

describe('the GalleryView component', () => {
  it('should render correctly', () => {
    const wrapper = shallow(<GalleryView />);
    expect(wrapper).toMatchSnapshot();
    expect(useGalleryViewLayout).toHaveBeenCalledWith(9);
  });

  it('should not render the previous page button when the user is viewing the first page', () => {
    mockUsePagination.mockImplementationOnce(() => ({
      currentPage: 1,
      totalPages: 4,
      setCurrentPage: jest.fn(),
      paginatedParticipants: [mockLocalParticipant, ...mockParticipants],
    }));

    const wrapper = shallow(<GalleryView />);
    expect(
      wrapper
        .find('.makeStyles-buttonContainerLeft-4')
        .childAt(0)
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find('.makeStyles-buttonContainerRight-5')
        .childAt(0)
        .exists()
    ).toBe(true);
  });

  it('should not render the next page button when the user is viewing the last page', () => {
    mockUsePagination.mockImplementationOnce(() => ({
      currentPage: 4,
      totalPages: 4,
      setCurrentPage: jest.fn(),
      paginatedParticipants: [mockLocalParticipant, ...mockParticipants],
    }));

    const wrapper = shallow(<GalleryView />);
    expect(
      wrapper
        .find('.makeStyles-buttonContainerLeft-4')
        .childAt(0)
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find('.makeStyles-buttonContainerRight-5')
        .childAt(0)
        .exists()
    ).toBe(false);
  });

  it('keeps page navigation callbacks and remote-only visible counts', () => {
    const setCurrentPage = jest.fn();
    mockLocalParticipant.identity = 'Profe [Profesor]';
    mockUsePagination.mockImplementationOnce(() => ({
      currentPage: 2,
      totalPages: 4,
      setCurrentPage,
      paginatedParticipants: [mockParticipants[1], mockParticipants[2]],
    }));
    try {
      const wrapper = shallow(<GalleryView />);
      expect(wrapper.find('[data-testid="gallery-student-count"]').text()).toBe('Mostrando 2 / 4 estudiantes');
      wrapper.find('[aria-label="Página anterior"]').simulate('click');
      wrapper.find('[aria-label="Página siguiente"]').simulate('click');
      expect(setCurrentPage.mock.calls[0][0](2)).toBe(1);
      expect(setCurrentPage.mock.calls[1][0](2)).toBe(3);
    } finally {
      mockLocalParticipant.identity = 'test-local-participant';
    }
  });

  it('includes the local participant as a regular gallery tile (parity for students and professors)', () => {
    shallow(<GalleryView />);
    // The list handed to usePagination must lead with the local participant, regardless of role.
    const lastCallArg = mockUsePagination.mock.calls[mockUsePagination.mock.calls.length - 1][0];
    expect(lastCallArg[0]).toBe(mockLocalParticipant);
    expect(lastCallArg).toEqual([mockLocalParticipant, ...mockParticipants]);
  });

  it('should not render the Pagination component when there is only one page', () => {
    mockUsePagination.mockImplementationOnce(() => ({
      currentPage: 1,
      totalPages: 1,
      setCurrentPage: jest.fn(),
      paginatedParticipants: [mockLocalParticipant, ...mockParticipants],
    }));

    const wrapper = shallow(<GalleryView />);
    expect(wrapper.find('.makeStyles-pagination-8').exists()).toBe(false);
  });

  describe('student tile moderation kebab', () => {
    const handlers = { onMuteVideo: jest.fn() };
    const originalIdentity = mockLocalParticipant.identity;
    const moderationByIdentity = () => {
      const wrapper = shallow(<GalleryView />);
      const result: Record<string, any> = {};
      wrapper.find(Participant).forEach(tile => {
        result[(tile.prop('participant') as any).identity] = tile.prop('moderation');
      });
      return result;
    };

    afterEach(() => {
      mockLocalParticipant.identity = originalIdentity;
      mockUseModerationActions.mockReturnValue(null);
    });

    it('gives a teacher the handlers on remote student tiles only', () => {
      mockLocalParticipant.identity = 'Profe [Profesor]';
      mockUseModerationActions.mockReturnValue(handlers);
      const result = moderationByIdentity();
      expect(result['test-participant-1']).toBe(handlers);
      expect(result['Profe [Profesor]']).toBeUndefined();
    });

    it('passes the handlers to another teacher tile too (the tile menu applies the owner-only rule)', () => {
      mockLocalParticipant.identity = 'Profe [Profesor]';
      mockUseModerationActions.mockReturnValue(handlers);
      mockParticipants[0].identity = 'Otra [Profesor]';
      try {
        expect(moderationByIdentity()['Otra [Profesor]']).toBe(handlers);
      } finally {
        mockParticipants[0].identity = 'test-participant-1';
      }
    });

    it('never offers the menu to a student viewer', () => {
      mockUseModerationActions.mockReturnValue(handlers);
      expect(moderationByIdentity()['test-participant-1']).toBeUndefined();
    });
  });
});

it('localizes gallery counts and pagination on a live language switch without changing participants', checkGalleryLocalization);
