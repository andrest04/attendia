import EventEmitter from 'events';
import { useModerationActions } from '../Room/ModerationMenu/moderationActionsContext';
import React from 'react';
import ParticipantList from './ParticipantList';
import { shallow } from 'enzyme';
import useMainParticipant from '../../hooks/useMainParticipant/useMainParticipant';
import useScreenShareParticipant from '../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useSelectedParticipant from '../VideoProvider/useSelectedParticipant/useSelectedParticipant';
import useParticipantContext from '../../hooks/useParticipantsContext/useParticipantsContext';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';

jest.mock('../../hooks/useParticipantsContext/useParticipantsContext');
jest.mock('../../hooks/useVideoContext/useVideoContext');
jest.mock('../VideoProvider/useSelectedParticipant/useSelectedParticipant');
jest.mock('../../hooks/useMainParticipant/useMainParticipant');
jest.mock('../../hooks/useScreenShareParticipant/useScreenShareParticipant');
jest.mock('../Room/ModerationMenu/moderationActionsContext', () => ({ useModerationActions: jest.fn() }));
const mockUseModerationActions = useModerationActions as jest.Mock<any>;

const mockParticipantContext = useParticipantContext as jest.Mock<any>;
const mockedVideoContext = useVideoContext as jest.Mock<any>;
const mockUseSelectedParticipant = useSelectedParticipant as jest.Mock<any>;
const mockUseMainParticipant = useMainParticipant as jest.Mock<any>;
const mockUseScreenShareParticipant = useScreenShareParticipant as jest.Mock<any>;

describe('the ParticipantList component', () => {
  let mockRoom: any;

  beforeEach(() => {
    mockUseSelectedParticipant.mockImplementation(() => [null, () => {}]);
    mockRoom = new EventEmitter();
    mockRoom.localParticipant = 'localParticipant';
  });

  it('should correctly render Participant components', () => {
    const mockParticipant = { sid: 2 };
    mockUseSelectedParticipant.mockImplementation(() => [mockParticipant, () => {}]);
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
    mockParticipantContext.mockImplementation(() => ({
      speakerViewParticipants: [{ sid: 0 }, { sid: 1 }, mockParticipant],
    }));

    const wrapper = shallow(<ParticipantList />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should add the isSelected prop to the first remote participant when it is selected', () => {
    const mockParticipant = { sid: 0 };
    mockUseSelectedParticipant.mockImplementation(() => [mockParticipant, () => {}]);
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
    mockParticipantContext.mockImplementation(() => ({
      speakerViewParticipants: [mockParticipant, { sid: 1 }],
    }));

    const wrapper = shallow(<ParticipantList />);
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(1)
        .prop('isSelected')
    ).toBe(true);
  });

  it('should not render anything when there are no remote particiants', () => {
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
    mockParticipantContext.mockImplementation(() => ({
      speakerViewParticipants: [],
    }));

    const wrapper = shallow(<ParticipantList />);
    expect(wrapper.getElement()).toBe(null);
  });

  it('should add the hideParticipant prop when the participant is the mainParticipant', () => {
    const mockParticipant = { sid: 0 };
    mockUseMainParticipant.mockImplementation(() => mockParticipant);
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
    mockParticipantContext.mockImplementation(() => ({
      speakerViewParticipants: [mockParticipant, { sid: 1 }],
    }));

    const wrapper = shallow(<ParticipantList />);
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

  it('should not add the hideParticipant prop when the participant is the mainParticipant and they are selected', () => {
    const mockParticipant = { sid: 0 };
    mockUseMainParticipant.mockImplementation(() => mockParticipant);
    mockUseSelectedParticipant.mockImplementation(() => [mockParticipant, () => {}]);
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
    mockParticipantContext.mockImplementation(() => ({
      speakerViewParticipants: [mockParticipant, { sid: 1 }],
    }));

    const wrapper = shallow(<ParticipantList />);
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(1)
        .prop('hideParticipant')
    ).toBe(false);
  });

  it('should not add the hideParticipant prop when the participant is the mainParticipant and they are sharing their screen', () => {
    const mockParticipant = { sid: 0 };
    mockUseMainParticipant.mockImplementation(() => mockParticipant);
    mockUseScreenShareParticipant.mockImplementation(() => mockParticipant);
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
    mockParticipantContext.mockImplementation(() => ({
      speakerViewParticipants: [mockParticipant, { sid: 1 }],
    }));

    const wrapper = shallow(<ParticipantList />);
    expect(
      wrapper
        .find('Memo(Participant)')
        .at(1)
        .prop('hideParticipant')
    ).toBe(false);
  });

  it('passes the moderation handlers to remote tiles only, and only for a teacher', () => {
    const handlers = { onMuteVideo: jest.fn() };
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
    mockParticipantContext.mockImplementation(() => ({ speakerViewParticipants: [{ sid: 1 }] }));

    mockUseModerationActions.mockImplementation(() => handlers);
    let tiles = shallow(<ParticipantList />).find('Memo(Participant)');
    expect(tiles.at(0).prop('moderation')).toBeUndefined();
    expect(tiles.at(1).prop('moderation')).toBe(handlers);

    mockUseModerationActions.mockImplementation(() => null);
    tiles = shallow(<ParticipantList />).find('Memo(Participant)');
    expect(tiles.at(1).prop('moderation')).toBeUndefined();
  });
});
