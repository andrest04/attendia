import EventEmitter from 'events';
import { useModerationActions } from '../ModerationMenu/moderationActionsContext';
import React from 'react';
import ParticipantStrip from './ParticipantStrip';
import { shallow } from 'enzyme';
import useMainParticipant from '../../../hooks/useMainParticipant/useMainParticipant';
import useScreenShareParticipant from '../../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useSelectedParticipant from '../../VideoProvider/useSelectedParticipant/useSelectedParticipant';
import useParticipantsContext from '../../../hooks/useParticipantsContext/useParticipantsContext';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

jest.mock('../../../hooks/useParticipantsContext/useParticipantsContext');
jest.mock('../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../VideoProvider/useSelectedParticipant/useSelectedParticipant');
jest.mock('../../../hooks/useMainParticipant/useMainParticipant');
jest.mock('../../../hooks/useScreenShareParticipant/useScreenShareParticipant');
jest.mock('../ModerationMenu/moderationActionsContext', () => ({ useModerationActions: jest.fn() }));
const mockUseModerationActions = useModerationActions as jest.Mock<any>;

const mockUseParticipantsContext = useParticipantsContext as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseSelectedParticipant = useSelectedParticipant as jest.Mock<any>;
const mockUseMainParticipant = useMainParticipant as jest.Mock<any>;
const mockUseScreenShareParticipant = useScreenShareParticipant as jest.Mock<any>;

describe('the ParticipantStrip component', () => {
  let mockRoom: any;

  beforeEach(() => {
    mockUseSelectedParticipant.mockImplementation(() => [null, () => {}]);
    mockUseMainParticipant.mockImplementation(() => null);
    mockUseScreenShareParticipant.mockImplementation(() => undefined);
    mockRoom = new EventEmitter();
    mockRoom.localParticipant = { sid: 'local', identity: 'local-user' };
    mockUseVideoContext.mockImplementation(() => ({ room: mockRoom }));
  });

  it('renders null when there are no remote participants', () => {
    mockUseParticipantsContext.mockImplementation(() => ({
      speakerViewParticipants: [],
    }));
    const wrapper = shallow(<ParticipantStrip />);
    expect(wrapper.getElement()).toBe(null);
  });

  it('renders the strip container with data-testid when there are remote participants', () => {
    mockUseParticipantsContext.mockImplementation(() => ({
      speakerViewParticipants: [{ sid: 'p1', identity: 'student-a' }],
    }));
    const wrapper = shallow(<ParticipantStrip />);
    expect(wrapper.prop('data-testid')).toBe('participant-strip');
  });

  it('renders one tile per participant including the local participant', () => {
    const remoteParticipants = [
      { sid: 'p1', identity: 'student-a' },
      { sid: 'p2', identity: 'student-b' },
    ];
    mockUseParticipantsContext.mockImplementation(() => ({
      speakerViewParticipants: remoteParticipants,
    }));
    const wrapper = shallow(<ParticipantStrip />);
    // local + 2 remote = 3 Participant tiles
    expect(wrapper.find('Memo(Participant)').length).toBe(3);
  });

  it('renders the local participant first with isLocalParticipant=true', () => {
    mockUseParticipantsContext.mockImplementation(() => ({
      speakerViewParticipants: [{ sid: 'p1', identity: 'student-a' }],
    }));
    const wrapper = shallow(<ParticipantStrip />);
    const first = wrapper.find('Memo(Participant)').at(0);
    expect(first.prop('participant')).toBe(mockRoom.localParticipant);
    expect(first.prop('isLocalParticipant')).toBe(true);
  });

  it('hides a remote participant when they are the main participant (mirrors ParticipantList)', () => {
    const mainP = { sid: 'p1', identity: 'student-a' };
    mockUseMainParticipant.mockImplementation(() => mainP);
    mockUseParticipantsContext.mockImplementation(() => ({
      speakerViewParticipants: [mainP, { sid: 'p2', identity: 'student-b' }],
    }));
    const wrapper = shallow(<ParticipantStrip />);
    // index 0 = local, index 1 = mainP (should be hidden), index 2 = other
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(1)
        .prop('hideParticipant')
    ).toBe(true);
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(2)
        .prop('hideParticipant')
    ).toBe(false);
  });

  it('does not hide the main participant when they are selected', () => {
    const mainP = { sid: 'p1', identity: 'student-a' };
    mockUseMainParticipant.mockImplementation(() => mainP);
    mockUseSelectedParticipant.mockImplementation(() => [mainP, () => {}]);
    mockUseParticipantsContext.mockImplementation(() => ({
      speakerViewParticipants: [mainP],
    }));
    const wrapper = shallow(<ParticipantStrip />);
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(1)
        .prop('hideParticipant')
    ).toBe(false);
  });

  it('does not hide the main participant when they are screen-sharing', () => {
    const mainP = { sid: 'p1', identity: 'student-a' };
    mockUseMainParticipant.mockImplementation(() => mainP);
    mockUseScreenShareParticipant.mockImplementation(() => mainP);
    mockUseParticipantsContext.mockImplementation(() => ({
      speakerViewParticipants: [mainP],
    }));
    const wrapper = shallow(<ParticipantStrip />);
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(1)
        .prop('hideParticipant')
    ).toBe(false);
  });

  it('marks the selected participant with isSelected=true and wires an onClick', () => {
    const selected = { sid: 'p1', identity: 'student-a' };
    mockUseSelectedParticipant.mockImplementation(() => [selected, jest.fn()]);
    mockUseParticipantsContext.mockImplementation(() => ({
      speakerViewParticipants: [selected, { sid: 'p2', identity: 'student-b' }],
    }));
    const wrapper = shallow(<ParticipantStrip />);
    // at(1) = first remote participant = selected
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(1)
        .prop('isSelected')
    ).toBe(true);
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(2)
        .prop('isSelected')
    ).toBe(false);
  });

  describe('moderation menu', () => {
    const handlers = { onMuteVideo: jest.fn() };
    beforeEach(() => {
      mockUseParticipantsContext.mockImplementation(() => ({
        speakerViewParticipants: [{ sid: 'p1', identity: 'student-a' }],
      }));
    });

    it('passes the moderation handlers to remote tiles only when a teacher provides them', () => {
      mockUseModerationActions.mockImplementation(() => handlers);
      const tiles = shallow(<ParticipantStrip />).find('Memo(Participant)');
      expect(tiles.at(0).prop('moderation')).toBeUndefined();
      expect(tiles.at(1).prop('moderation')).toBe(handlers);
    });

    it('passes no moderation handlers without a teacher provider', () => {
      mockUseModerationActions.mockImplementation(() => null);
      const tiles = shallow(<ParticipantStrip />).find('Memo(Participant)');
      expect(tiles.at(1).prop('moderation')).toBeUndefined();
    });
  });
});
