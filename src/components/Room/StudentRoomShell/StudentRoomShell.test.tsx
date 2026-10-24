import React from 'react';
import { mount } from 'enzyme';
import StudentRoomShell from './StudentRoomShell';
import SessionStatusBar from '../ProfessorRoomShell/SessionStatusBar';
import { setLocale } from '../../../i18n/locale';

describe('StudentRoomShell', () => {
  afterEach(() => setLocale('es'));

  it('renders the top session status bar without the Ayuda button', () => {
    const wrapper = mount(
      <StudentRoomShell stage={<div>stage</div>} sessionName="Matemáticas — Grupo A" participantCount={5} recording />
    );

    const bar = wrapper.find(SessionStatusBar);
    expect(bar.exists()).toBe(true);
    expect(bar.prop('sessionName')).toBe('Matemáticas — Grupo A');
    // 5 in the room minus the professor → 4 students.
    expect(bar.prop('studentCount')).toBe(4);
    expect(bar.prop('recording')).toBe(true);
    expect(bar.prop('showHelpButton')).toBe(false);
  });

  it('renders shell primitives and the plain participant count', () => {
    const wrapper = mount(
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

  it('renders the plain participant count in English', () => {
    setLocale('en');
    const wrapper = mount(<StudentRoomShell stage={<div>stage</div>} participantCount={3} />);

    expect(wrapper.find('[data-testid="student-room-shell-participant-count"]').text()).toContain('3 in the room');
  });

  it('does not render a notifications panel (notifications are professor-only)', () => {
    const wrapper = mount(<StudentRoomShell stage={<div>stage</div>} />);

    expect(wrapper.find('[data-testid="student-room-shell-notifications-empty"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Notificaciones');
  });

  it('renders connectivity banner only when degraded flag is true', () => {
    const hiddenWrapper = mount(<StudentRoomShell stage={<div>stage</div>} isConnectivityDegraded={false} />);
    expect(hiddenWrapper.find('[data-testid="student-room-shell-connectivity-banner"]').exists()).toBe(false);

    const visibleWrapper = mount(<StudentRoomShell stage={<div>stage</div>} isConnectivityDegraded />);
    expect(visibleWrapper.find('[data-testid="student-room-shell-connectivity-banner"]').exists()).toBe(true);
  });

  it('renders provided stage and toolbar slots', () => {
    const wrapper = mount(
      <StudentRoomShell
        stage={<div data-testid="stage-content">stage</div>}
        toolbarSlot={<div data-testid="toolbar-content">toolbar</div>}
      />
    );

    expect(wrapper.find('[data-testid="stage-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="toolbar-content"]').exists()).toBe(true);
  });

  it('renders right panel content', () => {
    const wrapper = mount(
      <StudentRoomShell stage={<div>stage</div>} rightPanel={<div data-testid="right-panel-content">panel</div>} />
    );

    expect(wrapper.find('[data-testid="right-panel-content"]').exists()).toBe(true);
  });

  it('does not render a separate PiP self-view (the student sees their own gallery tile instead)', () => {
    const wrapper = mount(<StudentRoomShell stage={<div>stage</div>} />);

    expect(wrapper.find('[data-testid="student-room-shell-pip"]').exists()).toBe(false);
  });

  it('renders only the chat tab and no attention tab', () => {
    const wrapper = mount(<StudentRoomShell stage={<div>stage</div>} />);

    expect(wrapper.find('[data-testid="student-room-shell-tab-chat"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-room-shell-tab-attention"]').exists()).toBe(false);
  });

  describe('collapsible rails (Meet-style entry)', () => {
    // Rails stay mounted (collapsed to a 0px column) so they can animate open/closed;
    // aria-hidden reflects the visible state. Mounted (not shallow): the rails are slot
    // elements of RoomShellLayout, whose host markup only exists once it renders.
    it('marks both rails hidden when leftOpen and rightOpen are false', () => {
      const wrapper = mount(
        <StudentRoomShell
          stage={<div>stage</div>}
          rightPanel={<div data-testid="right-panel-content">panel</div>}
          leftOpen={false}
          rightOpen={false}
        />
      );
      expect(wrapper.find('aside[data-testid="student-room-shell-left-rail"]').prop('aria-hidden')).toBe(true);
      expect(wrapper.find('aside[data-testid="student-room-shell-right-rail"]').prop('aria-hidden')).toBe(true);
      // The stage and toolbar always stay put.
      expect(wrapper.find('[data-testid="student-room-shell-center-stage"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="student-room-shell-toolbar-slot"]').exists()).toBe(true);
    });

    it('marks only the right rail visible when just rightOpen is true', () => {
      const wrapper = mount(
        <StudentRoomShell
          stage={<div>stage</div>}
          rightPanel={<div data-testid="right-panel-content">panel</div>}
          leftOpen={false}
          rightOpen
        />
      );
      expect(wrapper.find('aside[data-testid="student-room-shell-left-rail"]').prop('aria-hidden')).toBe(true);
      expect(wrapper.find('aside[data-testid="student-room-shell-right-rail"]').prop('aria-hidden')).toBe(false);
      expect(wrapper.find('[data-testid="right-panel-content"]').exists()).toBe(true);
    });

    it('fires the close callbacks from each rail × button', () => {
      const onCloseLeft = jest.fn();
      const onCloseRight = jest.fn();
      const wrapper = mount(
        <StudentRoomShell
          stage={<div>stage</div>}
          leftOpen
          rightOpen
          onCloseLeft={onCloseLeft}
          onCloseRight={onCloseRight}
        />
      );
      wrapper.find('button[data-testid="student-room-shell-close-left"]').simulate('click');
      expect(onCloseLeft).toHaveBeenCalled();
      wrapper.find('button[data-testid="student-room-shell-close-right"]').simulate('click');
      expect(onCloseRight).toHaveBeenCalled();
    });
  });

  it('shows first + last word initials in the roster, like the professor roster', () => {
    const wrapper = mount(
      <StudentRoomShell stage={<div>stage</div>} participants={[{ identity: 'Ana Maria Perez' }]} />
    );

    expect(wrapper.text()).toContain('AP');
    expect(wrapper.text()).not.toContain('AM');
  });
});
