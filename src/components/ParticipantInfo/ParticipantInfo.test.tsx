import React from 'react';
import AvatarIcon from '../../icons/AvatarIcon';
import ParticipantInfo from './ParticipantInfo';
import PinIcon from './PinIcon/PinIcon';
import { shallow } from 'enzyme';
import { useRaisedHand } from '../../hooks/useRaiseHand/raisedHandsContext';
import { useAppState } from '../../state';
import useIsTrackSwitchedOff from '../../hooks/useIsTrackSwitchedOff/useIsTrackSwitchedOff';
import useParticipantIsReconnecting from '../../hooks/useParticipantIsReconnecting/useParticipantIsReconnecting';
import usePublications from '../../hooks/usePublications/usePublications';
import ScreenShareIcon from '../../icons/ScreenShareIcon';

jest.mock('../../state');
jest.mock('../../hooks/useRaiseHand/raisedHandsContext', () => ({ useRaisedHand: jest.fn() }));
jest.mock('../../hooks/useParticipantNetworkQualityLevel/useParticipantNetworkQualityLevel', () => () => 4);
jest.mock('../../hooks/usePublications/usePublications');
jest.mock('../../hooks/useIsTrackSwitchedOff/useIsTrackSwitchedOff');
jest.mock('../../hooks/useParticipantIsReconnecting/useParticipantIsReconnecting');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseRaisedHand = useRaisedHand as jest.Mock<boolean>;
const mockUsePublications = usePublications as jest.Mock<any>;
const mockUseIsTrackSwitchedOff = useIsTrackSwitchedOff as jest.Mock<any>;
const mockUseParticipantIsReconnecting = useParticipantIsReconnecting as jest.Mock<boolean>;

mockUseAppState.mockImplementation(() => ({ isGalleryViewActive: false }));

describe('the ParticipantInfo component', () => {
  it('should render the AvatarIcon component when no video tracks are published', () => {
    mockUsePublications.mockImplementation(() => []);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.find(AvatarIcon).exists()).toBe(true);
  });

  it('should not display the AvatarIcon component when a video track is published', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.find(AvatarIcon).exists()).toBe(false);
  });

  it('should render the AvatarIcon component when the video track is switchedOff', () => {
    mockUseIsTrackSwitchedOff.mockImplementation(() => true);
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.find(AvatarIcon).exists()).toBe(true);
  });

  it('should not render the reconnecting UI when the user is connected', () => {
    mockUseParticipantIsReconnecting.mockImplementationOnce(() => false);
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.text()).not.toContain('Reconnecting...');
  });

  it('should render the reconnecting UI when the user is reconnecting', () => {
    mockUseParticipantIsReconnecting.mockImplementationOnce(() => true);
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.text()).toContain('Reconnecting...');
  });

  it('should add hideParticipant class to container component when hideParticipant prop is true', () => {
    const wrapper = shallow(
      <ParticipantInfo
        onClick={() => {}}
        isSelected={false}
        participant={{ identity: 'mockIdentity' } as any}
        hideParticipant={true}
      >
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.prop('className')).toContain('hideParticipant');
  });

  it('should not add hideParticipant class to container component when hideParticipant prop is false', () => {
    const wrapper = shallow(
      <ParticipantInfo
        onClick={() => {}}
        isSelected={false}
        participant={{ identity: 'mockIdentity' } as any}
        hideParticipant={false}
      >
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.prop('className')).not.toContain('hideParticipant');
  });

  it('should add cursorPointer class to container component when onClick prop is present', () => {
    const wrapper = shallow(
      <ParticipantInfo isSelected={false} participant={{ identity: 'mockIdentity' } as any} onClick={() => {}}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.prop('className')).toContain('cursorPointer');
  });

  it('should not add cursorPointer class to container component when onClick prop is not present', () => {
    const wrapper = shallow(
      <ParticipantInfo isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.prop('className')).not.toContain('cursorPointer');
  });

  it('should render the PinIcon component when the participant is selected', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={true} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.exists(PinIcon)).toBe(true);
  });

  it('should not render the PinIcon component when the participant is not selected', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.exists(PinIcon)).toBe(false);
  });

  it('should render the ScreenShareIcon component when the participant is sharing their screen', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: 'screen', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.exists(ScreenShareIcon)).toBe(true);
  });

  it('should not render the ScreenShareIcon component when the participant is not sharing their screen', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.exists(ScreenShareIcon)).toBe(false);
  });

  it('should add "(Yo)" to the participants identity when they are the localParticipant', () => {
    mockUseIsTrackSwitchedOff.mockImplementation(() => false);
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo
        onClick={() => {}}
        isSelected={false}
        participant={{ identity: 'mockIdentity' } as any}
        isLocalParticipant
      >
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.text()).toContain('mockIdentity (Yo)');
  });

  it('should not add "(Yo)" to the participants identity when they are not the localParticipant', () => {
    mockUseIsTrackSwitchedOff.mockImplementation(() => false);
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.text()).not.toContain('mockIdentity (Yo)');
  });

  it('should not render the attention overlay when no attention prop is provided', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo onClick={() => {}} isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.find('[data-testid="participant-attention-overlay"]').exists()).toBe(false);
  });

  it('should render the attention badge with the level label when attention is provided', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo
        onClick={() => {}}
        isSelected={false}
        participant={{ identity: 'mockIdentity' } as any}
        attention={{ level: 'low', multiface: false }}
      >
        mock children
      </ParticipantInfo>
    );
    const overlay = wrapper.find('[data-testid="participant-attention-overlay"]');
    expect(overlay.exists()).toBe(true);
    expect(overlay.text()).toContain('Bajo');
    expect(wrapper.find('[data-testid="participant-multiface-flag"]').exists()).toBe(false);
  });

  it('should render the multiface flag when attention reports multiple faces', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo
        onClick={() => {}}
        isSelected={false}
        participant={{ identity: 'mockIdentity' } as any}
        attention={{ level: 'high', multiface: true }}
      >
        mock children
      </ParticipantInfo>
    );
    const flag = wrapper.find('[data-testid="participant-multiface-flag"]');
    expect(flag.exists()).toBe(true);
    expect(flag.text()).toContain('Multi-rostro');
  });

  it('should suppress the attention level badge when the camera is off', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo
        onClick={() => {}}
        isSelected={false}
        participant={{ identity: 'mockIdentity' } as any}
        attention={{ level: 'high', multiface: false, cameraOff: true }}
      >
        mock children
      </ParticipantInfo>
    );
    // The stale level badge must not render while the camera is off.
    expect(wrapper.find('[data-testid="participant-attention-overlay"]').exists()).toBe(false);
  });

  it('should render the medium level with its full Spanish word', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo
        onClick={() => {}}
        isSelected={false}
        participant={{ identity: 'mockIdentity' } as any}
        attention={{ level: 'medium', multiface: false }}
      >
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.find('[data-testid="participant-attention-overlay"]').text()).toContain('Medio');
  });

  it('renders a raised-hand badge when this participant is raising their hand', () => {
    mockUseRaisedHand.mockReturnValueOnce(true);
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.find('[data-testid="participant-raised-hand"]').exists()).toBe(true);
  });

  it('does not render a raised-hand badge when this participant is not raising their hand', () => {
    mockUseRaisedHand.mockReturnValueOnce(false);
    mockUsePublications.mockImplementation(() => [{ trackName: '', kind: 'video' }]);
    const wrapper = shallow(
      <ParticipantInfo isSelected={false} participant={{ identity: 'mockIdentity' } as any}>
        mock children
      </ParticipantInfo>
    );
    expect(wrapper.find('[data-testid="participant-raised-hand"]').exists()).toBe(false);
  });
});
