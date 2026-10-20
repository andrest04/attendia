import React from 'react';
import { shallow } from 'enzyme';
import ClassesTab from './ClassesTab';
import { mockDashboardData } from './mockDashboardData';

describe('ClassesTab', () => {
  it('renders every stat card and upcoming session card', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
      />
    );

    mockDashboardData.stats.forEach(stat => {
      expect(wrapper.find(`[data-testid="dashboard-stat-${stat.id}"]`).exists()).toBe(true);
    });
    mockDashboardData.upcomingSessions.forEach(session => {
      expect(wrapper.find(`[data-testid="dashboard-session-card-${session.id}"]`).exists()).toBe(true);
    });
  });

  it('calls onStartClass with the slugified room name and suffixed teacher display name on the highlighted card', () => {
    const onStartClass = jest.fn();
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName="Prof. García"
        onStartClass={onStartClass}
      />
    );

    wrapper.find('[data-testid="dashboard-start-session-button"]').simulate('click');

    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'matematicas-grupo-a',
      name: 'Prof. García [Profesor]',
    });
  });

  it('renders only one wired "Iniciar sesión" button, and stub "Ver detalles" buttons for the rest when no onCancelClass is passed', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-start-session-button"]').length).toBe(1);
    expect(wrapper.find('[data-testid="dashboard-view-details-button"]').length).toBe(
      mockDashboardData.upcomingSessions.length - 1
    );
    expect(wrapper.find('[data-testid="dashboard-cancel-session-button"]').length).toBe(0);
  });

  it('renders "Cancelar" buttons instead of the stub, and calls onCancelClass with the session', () => {
    const onCancelClass = jest.fn();
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelClass={onCancelClass}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-view-details-button"]').length).toBe(0);
    const cancelButtons = wrapper.find('[data-testid="dashboard-cancel-session-button"]');
    expect(cancelButtons.length).toBe(mockDashboardData.upcomingSessions.length - 1);

    const nonHighlighted = mockDashboardData.upcomingSessions.find(s => !s.highlighted)!;
    cancelButtons.first().simulate('click');

    expect(onCancelClass).toHaveBeenCalledWith(nonHighlighted);
  });

  it('shows cancellation progress and a visible retry action after a failed cancellation', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelClass={jest.fn()}
        cancellingClassId={mockDashboardData.upcomingSessions[1].id}
        cancelError="No pudimos cancelar la clase."
        onRetryCancel={jest.fn()}
      />
    );

    expect(
      wrapper
        .find('[data-testid="dashboard-cancel-session-button"]')
        .at(0)
        .prop('disabled')
    ).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-cancel-error"]').text()).toContain('No pudimos cancelar la clase.');
    expect(wrapper.find('[data-testid="dashboard-retry-cancel-button"]').exists()).toBe(true);
  });

  it('does not render the "Cancelar vencidas" button when there are no expired classes', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelExpiredClasses={jest.fn()}
        expiredClassesCount={0}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-cancel-expired-button"]').exists()).toBe(false);
  });

  it('renders the "Cancelar vencidas" button with a count and calls onCancelExpiredClasses when clicked', () => {
    const onCancelExpiredClasses = jest.fn();
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelExpiredClasses={onCancelExpiredClasses}
        expiredClassesCount={3}
      />
    );

    const button = wrapper.find('[data-testid="dashboard-cancel-expired-button"]');
    expect(button.text()).toContain('3 vencidas');

    button.simulate('click');
    expect(onCancelExpiredClasses).toHaveBeenCalled();
  });

  it('disables the "Cancelar vencidas" button and shows the error while cancelling', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelExpiredClasses={jest.fn()}
        expiredClassesCount={1}
        isCancellingExpired
        cancelExpiredError="No pudimos cancelar 1 clase vencida."
      />
    );

    expect(wrapper.find('[data-testid="dashboard-cancel-expired-button"]').prop('disabled')).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-cancel-expired-error"]').text()).toContain(
      'No pudimos cancelar 1 clase vencida.'
    );
  });

  it('does not render the expired-sessions section when there are no expired sessions', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        expiredSessions={[]}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-expired-sessions-section"]').exists()).toBe(false);
  });

  it('renders each expired session grayed out with its own cancel button wired to onCancelClass', () => {
    const onCancelClass = jest.fn();
    const expiredSessions = [
      {
        id: 'expired-1',
        title: 'Química — Grupo B',
        code: 'quimica-grupo-b',
        time: '9:00 am',
        studentCount: 10,
        dayLabel: 'Hoy',
        relativeLabel: 'Venció hace 2h',
        highlighted: false,
      },
    ];
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelClass={onCancelClass}
        expiredSessions={expiredSessions}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-expired-sessions-section"]').exists()).toBe(true);
    const card = wrapper.find('[data-testid="dashboard-expired-session-card-expired-1"]');
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain('Venció hace 2h');

    wrapper.find('[data-testid="dashboard-cancel-expired-session-button"]').simulate('click');
    expect(onCancelClass).toHaveBeenCalledWith(expiredSessions[0]);
  });

  it("disables an expired session's cancel button while it is the one cancelling", () => {
    const expiredSessions = [
      {
        id: 'expired-1',
        title: 'Química — Grupo B',
        code: 'quimica-grupo-b',
        time: '9:00 am',
        studentCount: 10,
        dayLabel: 'Hoy',
        relativeLabel: 'Venció hace 2h',
        highlighted: false,
      },
    ];
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelClass={jest.fn()}
        expiredSessions={expiredSessions}
        cancellingClassId="expired-1"
      />
    );

    expect(wrapper.find('[data-testid="dashboard-cancel-expired-session-button"]').prop('disabled')).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-cancel-expired-session-button"]').text()).toContain('Cancelando…');
  });

  it('does nothing when "Nueva clase" is clicked without onCreateClass', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
      />
    );

    wrapper.find('[data-testid="dashboard-new-class-button"]').simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-new-class-title-input"]').exists()).toBe(false);
  });

  it('reveals the inline creation form and calls onCreateClass with the combined values', () => {
    const onCreateClass = jest.fn(() => Promise.resolve());
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCreateClass={onCreateClass}
      />
    );

    wrapper.find('[data-testid="dashboard-new-class-button"]').simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-new-class-title-input"]').exists()).toBe(true);

    wrapper
      .find('[data-testid="dashboard-new-class-title-input"]')
      .simulate('change', { target: { value: '  Física 101  ' } });
    // The date/time fields are @material-ui/pickers components whose onChange hands
    // back a Date directly (not a DOM change event) — mirror that contract here.
    // A future date is required now that scheduling in the past is rejected
    // (see the "rejects a past date/time" test below), so this is built off the
    // real clock instead of a hardcoded date that would eventually go stale.
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futureDateTime = new Date(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate(), 10, 0);
    wrapper.find('[data-testid="dashboard-new-class-date-input"]').simulate('change', futureDate);
    wrapper.find('[data-testid="dashboard-new-class-time-input"]').simulate('change', futureDateTime);
    wrapper
      .find('[data-testid="dashboard-new-class-student-count-input"]')
      .simulate('change', { target: { value: '15' } });
    wrapper.find('[data-testid="dashboard-new-class-duration-input"]').simulate('change', { target: { value: '90' } });

    wrapper.find('form').simulate('submit', { preventDefault: jest.fn() });

    expect(onCreateClass).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Física 101',
        scheduledAtMs: futureDateTime.getTime(),
        studentCount: 15,
        durationMinutes: 90,
        idempotencyKey: expect.any(String),
        roomName: 'fisica-101',
      })
    );
  });

  it('defaults the duration field to 60 minutes and rejects an invalid duration', () => {
    const onCreateClass = jest.fn(() => Promise.resolve());
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCreateClass={onCreateClass}
      />
    );

    wrapper.find('[data-testid="dashboard-new-class-button"]').simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-new-class-duration-input"]').prop('value')).toBe('60');

    wrapper
      .find('[data-testid="dashboard-new-class-title-input"]')
      .simulate('change', { target: { value: 'Física 101' } });
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    wrapper.find('[data-testid="dashboard-new-class-date-input"]').simulate('change', futureDate);
    wrapper.find('[data-testid="dashboard-new-class-time-input"]').simulate('change', futureDate);
    wrapper.find('[data-testid="dashboard-new-class-duration-input"]').simulate('change', { target: { value: '0' } });

    wrapper.find('form').simulate('submit', { preventDefault: jest.fn() });

    expect(onCreateClass).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('La duración de la clase no es válida.');
  });

  it('rejects a past date/time without calling onCreateClass', () => {
    const onCreateClass = jest.fn(() => Promise.resolve());
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCreateClass={onCreateClass}
      />
    );

    wrapper.find('[data-testid="dashboard-new-class-button"]').simulate('click');
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-new-class-title-input"]')
      .simulate('change', { target: { value: 'Física 101' } });
    const pastDateTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    wrapper.find('[data-testid="dashboard-new-class-date-input"]').simulate('change', pastDateTime);
    wrapper.find('[data-testid="dashboard-new-class-time-input"]').simulate('change', pastDateTime);

    wrapper.find('form').simulate('submit', { preventDefault: jest.fn() });
    wrapper.update();

    expect(onCreateClass).not.toHaveBeenCalled();
    expect(wrapper.find('form').text()).toContain('No puedes programar una clase en una fecha u hora pasada.');
  });

  it('does not show "Datos simulados" tags when stats/sessions are real', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-stats-mock-tag"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dashboard-sessions-mock-tag"]').exists()).toBe(false);
  });

  it('shows the "Datos simulados" tag next to the stat cards when statsAreMock is true', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        statsAreMock
      />
    );

    expect(wrapper.find('[data-testid="dashboard-stats-mock-tag"]').text()).toBe('Datos simulados');
    expect(wrapper.find('[data-testid="dashboard-sessions-mock-tag"]').exists()).toBe(false);
  });

  it('shows the "Datos simulados" tag next to "Próximas sesiones" when sessionsAreMock is true', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        sessionsAreMock
      />
    );

    expect(wrapper.find('[data-testid="dashboard-sessions-mock-tag"]').text()).toBe('Datos simulados');
    expect(wrapper.find('[data-testid="dashboard-stats-mock-tag"]').exists()).toBe(false);
  });

  it('disables "Iniciar sesión" and shows "Verificando…" while isStartingClass is true', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        isStartingClass
      />
    );

    const button = wrapper.find('[data-testid="dashboard-start-session-button"]');
    expect(button.prop('disabled')).toBe(true);
    expect(button.text()).toContain('Verificando…');
  });

  it('renders startClassError in a dedicated banner, and nothing when unset', () => {
    const wrapperWithError = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        startClassError="Ya hay una sesión activa con este nombre de sala. Espera a que termine o cambia el título de la clase."
      />
    );

    expect(wrapperWithError.find('[data-testid="dashboard-start-error"]').text()).toContain(
      'Ya hay una sesión activa con este nombre de sala.'
    );

    const wrapperWithoutError = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
      />
    );

    expect(wrapperWithoutError.find('[data-testid="dashboard-start-error"]').exists()).toBe(false);
  });

  describe('started classes', () => {
    const startedRecord = {
      id: 'c1',
      title: 'Álgebra',
      roomName: 'algebra',
      scheduledAtMs: 0,
      studentCount: 3,
      durationMinutes: 60,
      status: 'started' as const,
    };
    const startedSession = {
      id: 'c1',
      title: 'Álgebra',
      code: 'algebra',
      roomName: 'algebra',
      classId: 'c1',
      time: '10:00 AM',
      studentCount: 3,
      dayLabel: 'Hoy',
      relativeLabel: 'Ahora',
      highlighted: true,
    };
    const render = (startedRoomStatus: Record<string, boolean | null>, onStartClass = jest.fn()) =>
      shallow(
        <ClassesTab
          stats={mockDashboardData.stats}
          dateLabel="Hoy"
          sessions={[startedSession]}
          existingClasses={[startedRecord]}
          startedRoomStatus={startedRoomStatus}
          professorName="Ana"
          onStartClass={onStartClass}
        />
      );

    it('offers "Volver a entrar" when the started class room is still open', () => {
      const onStartClass = jest.fn();
      const wrapper = render({ algebra: true }, onStartClass);

      const button = wrapper.find('[data-testid="dashboard-rejoin-session-button"]');
      expect(button.text()).toContain('Volver a entrar');
      expect(wrapper.find('[data-testid="dashboard-start-session-button"]').exists()).toBe(false);

      button.simulate('click');
      expect(onStartClass).toHaveBeenCalledWith({
        roomName: 'algebra',
        name: 'Ana [Profesor]',
        classId: 'c1',
      });
    });

    it('explains the room closed and keeps an explicit restart', () => {
      const onStartClass = jest.fn();
      const wrapper = render({ algebra: false }, onStartClass);

      expect(wrapper.find('[data-testid="dashboard-room-closed-note"]').text()).toContain('La sala ya se cerró');
      wrapper.find('[data-testid="dashboard-restart-session-button"]').simulate('click');
      expect(onStartClass).toHaveBeenCalledWith({ roomName: 'algebra', name: 'Ana [Profesor]', classId: 'c1' });
    });

    it('shows a disabled checking button until the room is probed', () => {
      const wrapper = render({});

      const button = wrapper.find('[data-testid="dashboard-checking-session-button"]');
      expect(button.prop('disabled')).toBe(true);
    });

    it('lists a started class that is not among the sessions in an in-progress section', () => {
      const wrapper = shallow(
        <ClassesTab
          stats={mockDashboardData.stats}
          dateLabel="Hoy"
          sessions={[]}
          existingClasses={[startedRecord]}
          startedRoomStatus={{ algebra: true }}
          professorName="Ana"
          onStartClass={jest.fn()}
        />
      );

      expect(wrapper.find('[data-testid="dashboard-in-progress-section"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="dashboard-rejoin-session-button"]').length).toBe(1);
    });
  });
});
