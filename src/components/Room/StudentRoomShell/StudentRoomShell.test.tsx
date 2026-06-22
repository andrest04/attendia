import React from 'react';
import { shallow } from 'enzyme';
import StudentRoomShell from './StudentRoomShell';

describe('StudentRoomShell', () => {
  it('renders shell primitives and the plain participant count', () => {
    const wrapper = shallow(
      <StudentRoomShell
        stage={<div data-testid="stage-content">stage</div>}
        toolbarSlot={<div data-testid="toolbar-content">toolbar</div>}
        participantCount={3}
      />
    );

    expect(wrapper.find('[data-testid="student-room-shell-left-rail"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-room-shell-stage-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-room-shell-toolbar-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-room-shell-right-tabs"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-room-shell-participant-count"]').text()).toContain('3 en sala');
  });

  it('does not render a notifications panel (notifications are professor-only)', () => {
    const wrapper = shallow(<StudentRoomShell stage={<div>stage</div>} />);

    expect(wrapper.find('[data-testid="student-room-shell-notifications-empty"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Notificaciones');
  });

  it('renders connectivity banner only when degraded flag is true', () => {
    const hiddenWrapper = shallow(<StudentRoomShell stage={<div>stage</div>} isConnectivityDegraded={false} />);
    expect(hiddenWrapper.find('[data-testid="student-room-shell-connectivity-banner"]').exists()).toBe(false);

    const visibleWrapper = shallow(<StudentRoomShell stage={<div>stage</div>} isConnectivityDegraded />);
    expect(visibleWrapper.find('[data-testid="student-room-shell-connectivity-banner"]').exists()).toBe(true);
  });

  it('renders provided stage and toolbar slots', () => {
    const wrapper = shallow(
      <StudentRoomShell
        stage={<div data-testid="stage-content">stage</div>}
        toolbarSlot={<div data-testid="toolbar-content">toolbar</div>}
      />
    );

    expect(wrapper.find('[data-testid="stage-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="toolbar-content"]').exists()).toBe(true);
  });

  it('renders right panel content', () => {
    const wrapper = shallow(
      <StudentRoomShell stage={<div>stage</div>} rightPanel={<div data-testid="right-panel-content">panel</div>} />
    );

    expect(wrapper.find('[data-testid="right-panel-content"]').exists()).toBe(true);
  });

  it('does not render a separate PiP self-view (the student sees their own gallery tile instead)', () => {
    const wrapper = shallow(<StudentRoomShell stage={<div>stage</div>} />);

    expect(wrapper.find('[data-testid="student-room-shell-pip"]').exists()).toBe(false);
  });

  it('renders only the chat tab and no attention tab', () => {
    const wrapper = shallow(<StudentRoomShell stage={<div>stage</div>} />);

    expect(wrapper.find('[data-testid="student-room-shell-tab-chat"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-room-shell-tab-attention"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="student-room-shell-tab-chat"]').prop('aria-pressed')).toBe(true);
  });

  it('collapses and reopens the chat panel via the chat tab, keeping the toggle always visible', () => {
    const wrapper = shallow(
      <StudentRoomShell stage={<div>stage</div>} rightPanel={<div data-testid="right-panel-content">panel</div>} />
    );

    expect(wrapper.find('[data-testid="right-panel-content"]').exists()).toBe(true);

    // Collapse: panel content hidden, but the toggle button stays so it can be reopened.
    wrapper.find('[data-testid="student-room-shell-tab-chat"]').simulate('click');
    expect(wrapper.find('[data-testid="right-panel-content"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="student-room-shell-tab-chat"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-room-shell-tab-chat"]').prop('aria-pressed')).toBe(false);

    // Reopen.
    wrapper.find('[data-testid="student-room-shell-tab-chat"]').simulate('click');
    expect(wrapper.find('[data-testid="right-panel-content"]').exists()).toBe(true);
  });
});
