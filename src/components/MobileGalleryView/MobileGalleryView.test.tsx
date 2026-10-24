import { MobileGalleryView } from './MobileGalleryView';
import { shallow } from 'enzyme';
import { useAppState } from '../../state';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { useModerationActions } from '../Room/ModerationMenu/moderationActionsContext';
import useParticipantContext from '../../hooks/useParticipantsContext/useParticipantsContext';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';

const mockLocalParticipant = { identity: 'test-local-participant', sid: 0 };

jest.mock('swiper/react', () => ({
  Swiper: jest.fn(),
  SwiperSlide: jest.fn(),
}));

jest.mock('swiper/modules', () => ({
  Pagination: jest.fn(),
}));

jest.mock('../../hooks/useParticipantsContext/useParticipantsContext');
jest.mock('../../hooks/useVideoContext/useVideoContext');
jest.mock('../../state');
jest.mock('@material-ui/core/useMediaQuery');
jest.mock('../Room/ModerationMenu/moderationActionsContext', () => ({ useModerationActions: jest.fn() }));
const mockUseModerationActions = useModerationActions as jest.Mock<any>;

const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseParticipantContext = useParticipantContext as jest.Mock<any>;
const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseMediaQuery = useMediaQuery as jest.Mock<any>;

mockUseAppState.mockImplementation(() => ({ maxGalleryViewParticipants: 9 }));
mockUseVideoContext.mockImplementation(() => ({
  room: {
    localParticipant: mockLocalParticipant,
  },
}));
mockUseParticipantContext.mockImplementation(() => ({
  mobileGalleryViewParticipants: [],
}));

describe('the MobileGalleryView component', () => {
  describe('in portrait orientation', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockImplementation(() => false);
    });

    it('should render correctly when there is only the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(1);
      expect(containers.prop('style')).toMatchObject({
        height: '100%',
        width: '100%',
      });
    });

    it('should render correctly when there is one participant plus the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [{ identity: 'test-participant-1', sid: 1 }],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(2);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '50%',
        width: '100%',
      });
    });

    it('should render correctly when there are two participants plus the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [
          { identity: 'test-participant-1', sid: 1 },
          { identity: 'test-participant-2', sid: 2 },
        ],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(3);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '33.33%',
        width: '100%',
      });
    });

    it('should render correctly when there are 3 participants plus the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [
          { identity: 'test-participant-1', sid: 1 },
          { identity: 'test-participant-2', sid: 2 },
          { identity: 'test-participant-3', sid: 3 },
        ],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(4);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '50%',
        width: '50%',
      });
    });

    it('should render correctly when there are 3 or more participants plus the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [
          { identity: 'test-participant-1', sid: 1 },
          { identity: 'test-participant-2', sid: 2 },
          { identity: 'test-participant-3', sid: 3 },
          { identity: 'test-participant-4', sid: 4 },
        ],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(5);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '33.33%',
        width: '50%',
      });
    });
  });

  describe('in landscape orientation', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockImplementation(() => true);
    });

    it('should render correctly when there is only the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(1);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '100%',
        width: '100%',
      });
    });

    it('should render correctly when there is one participant plus the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [{ identity: 'test-participant-1', sid: 1 }],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(2);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '100%',
        width: '50%',
      });
    });

    it('should render correctly when there are two participants plus the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [
          { identity: 'test-participant-1', sid: 1 },
          { identity: 'test-participant-2', sid: 2 },
        ],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(3);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '100%',
        width: '33.33%',
      });
    });

    it('should render correctly when there are 3 participants plus the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [
          { identity: 'test-participant-1', sid: 1 },
          { identity: 'test-participant-2', sid: 2 },
          { identity: 'test-participant-3', sid: 3 },
        ],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(4);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '50%',
        width: '50%',
      });
    });

    it('should render correctly when there are 3 or more participants plus the localParticipant', () => {
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [
          { identity: 'test-participant-1', sid: 1 },
          { identity: 'test-participant-2', sid: 2 },
          { identity: 'test-participant-3', sid: 3 },
          { identity: 'test-participant-4', sid: 4 },
        ],
      }));

      const wrapper = shallow(<MobileGalleryView />);
      const containers = wrapper.find('[data-test-id="participantContainer"]');
      expect(containers.length).toBe(5);
      expect(containers.at(0).prop('style')).toMatchObject({
        height: '50%',
        width: '33.33%',
      });
    });
  });

  describe('moderation menu', () => {
    const handlers = { onMuteVideo: jest.fn() };
    beforeEach(() => {
      mockUseMediaQuery.mockImplementation(() => false);
      mockUseParticipantContext.mockImplementation(() => ({
        mobileGalleryViewParticipants: [{ identity: 'student-a', sid: 1 }],
      }));
    });

    it('passes the handlers to remote tiles only, and only for a teacher', () => {
      mockUseModerationActions.mockImplementation(() => handlers);
      let tiles = shallow(<MobileGalleryView />).find('Memo(Participant)');
      expect(tiles.at(0).prop('moderation')).toBeUndefined();
      expect(tiles.at(1).prop('moderation')).toBe(handlers);

      mockUseModerationActions.mockImplementation(() => null);
      tiles = shallow(<MobileGalleryView />).find('Memo(Participant)');
      expect(tiles.at(1).prop('moderation')).toBeUndefined();
    });
  });
});
