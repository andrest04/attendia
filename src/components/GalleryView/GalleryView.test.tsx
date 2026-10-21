import React from 'react';
import { GalleryView } from './GalleryView';
import { shallow } from 'enzyme';
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

jest.mock('../../constants', () => ({
  GALLERY_VIEW_ASPECT_RATIO: 9 / 16,
  GALLERY_VIEW_MARGIN: 3,
}));
jest.mock('../../hooks/useSpeakerViewParticipants/useSpeakerViewParticipants', () => () => mockParticipants);
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
