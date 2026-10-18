import React from 'react';
import { mount } from 'enzyme';

import ProfessorRoomShell from './ProfessorRoomShell';
import { useAttention } from '../../AttentionProvider';

jest.mock('../../AttentionProvider');
// recharts' ResponsiveContainer needs a measurable parent; stub it out for jsdom.
// (AttentionTimelineChart, the live "Grupo" tab chart, still uses recharts.)
jest.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    AreaChart: Stub,
    Area: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    ReferenceLine: Stub,
  };
});
// AttentionReportView's zoom/scrub chart (rendered inside the live report modal)
// uses echarts, which needs a real canvas/SVG renderer jsdom doesn't provide.
jest.mock('echarts-for-react', () => ({
  __esModule: true,
  default: () => <div data-testid="attention-report-echarts-stub" />,
}));

const mockEnqueue = jest.fn();
jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueue, closeSnackbar: jest.fn() }),
}));

const mockUseAttention = useAttention as jest.Mock<any>;

const attentionLevel = (score: number): 'high' | 'medium' | 'low' => {
  if (score <= 40) return 'low';
  if (score <= 70) return 'medium';
  return 'high';
};

const baseAttention = {
  source: 'live' as const,
  groupAttention: 64,
  groupDataAvailable: true,
  attentionThreshold: 70,
  timeline: [
    { time: '0:00', value: 88 },
    { time: '0:05', value: 64 },
  ],
  fullTimeline: [
    { time: '0:00', value: 88 },
    { time: '0:05', value: 64 },
  ],
  participants: [
    { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false, cameraOff: false },
    { identity: 'Carlos López', index: 60, level: 'medium' as const, multiface: false, cameraOff: false },
    { identity: 'María Torres', index: 35, level: 'low' as const, multiface: true, cameraOff: false },
  ],
  proctoringAlerts: [
    { id: 'alert-001', identity: 'María Torres', kind: 'multiface' as const, detectedAt: '10:22', confidence: 0.91 },
    { id: 'alert-002', identity: 'Carlos López', kind: 'away' as const, detectedAt: '10:38', confidence: 0.78 },
  ],
  attentionLevel,
};

describe('ProfessorRoomShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAttention.mockImplementation(() => baseAttention);
  });

  it('renders the three-column shell primitives', () => {
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div data-testid="stage-content">stage</div>}
        toolbarSlot={<div data-testid="toolbar-content">toolbar</div>}
        participantCount={12}
      />
    );

    expect(wrapper.find('[data-testid="professor-room-shell-left-rail"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-room-shell-toolbar-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-room-shell-right-tabs"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stage-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="toolbar-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-room-shell-participant-count"]').text()).toContain('12');
  });

  describe('collapsible rails (Meet-style entry)', () => {
    // Rails stay mounted (collapsed to a 0px column) so they can animate open/closed;
    // aria-hidden reflects the visible state.
    it('marks both rails hidden when leftOpen and rightOpen are false', () => {
      const wrapper = mount(
        <ProfessorRoomShell stage={<div>stage</div>} participantCount={3} leftOpen={false} rightOpen={false} />
      );
      expect(wrapper.find('aside[data-testid="professor-room-shell-left-rail"]').prop('aria-hidden')).toBe(true);
      expect(wrapper.find('aside[data-testid="professor-room-shell-right-rail"]').prop('aria-hidden')).toBe(true);
      // The stage/toolbar always stay put.
      expect(wrapper.find('[data-testid="professor-room-shell-center-stage"]').exists()).toBe(true);
    });

    it('marks only the left rail visible when just leftOpen is true', () => {
      const wrapper = mount(
        <ProfessorRoomShell stage={<div>stage</div>} participantCount={3} leftOpen rightOpen={false} />
      );
      expect(wrapper.find('aside[data-testid="professor-room-shell-left-rail"]').prop('aria-hidden')).toBe(false);
      expect(wrapper.find('aside[data-testid="professor-room-shell-right-rail"]').prop('aria-hidden')).toBe(true);
    });

    it('fires the close callbacks from each rail × button', () => {
      const onCloseLeft = jest.fn();
      const onCloseRight = jest.fn();
      const wrapper = mount(
        <ProfessorRoomShell
          stage={<div>stage</div>}
          participantCount={3}
          leftOpen
          rightOpen
          onCloseLeft={onCloseLeft}
          onCloseRight={onCloseRight}
        />
      );
      wrapper
        .find('[data-testid="professor-room-shell-close-left"]')
        .first()
        .simulate('click');
      expect(onCloseLeft).toHaveBeenCalled();
      wrapper
        .find('[data-testid="professor-room-shell-close-right"]')
        .first()
        .simulate('click');
      expect(onCloseRight).toHaveBeenCalled();
    });
  });

  it('shows the notifications feed: empty state by default, student activity when present', () => {
    const empty = mount(<ProfessorRoomShell stage={<div>stage</div>} participantCount={1} />);
    expect(empty.find('[data-testid="professor-room-shell-notifications"]').exists()).toBe(true);
    expect(empty.find('[data-testid="professor-room-shell-notifications-empty"]').exists()).toBe(true);

    const withActivity = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        participantCount={2}
        notifications={[
          { id: 'joined-1', text: 'Ana se unió a la sesión', kind: 'participant', createdAt: 1 },
          { id: 'left-1', text: 'Luis salió de la sesión', kind: 'participant', createdAt: 2 },
        ]}
      />
    );
    expect(withActivity.find('[data-testid="professor-room-shell-notifications-empty"]').exists()).toBe(false);
    expect(withActivity.find('[data-testid="professor-room-shell-notifications"]').text()).toContain(
      'Ana se unió a la sesión'
    );
    expect(withActivity.find('[data-testid="professor-room-shell-notifications"]').text()).toContain(
      'Luis salió de la sesión'
    );
  });

  it('renders the session status bar with name, connected-student count and infra label', () => {
    const wrapper = mount(
      <ProfessorRoomShell stage={<div>stage</div>} sessionName="Matemáticas — Grupo A" participantCount={12} />
    );

    const bar = wrapper.find('[data-testid="professor-room-shell-session-bar"]');
    expect(bar.exists()).toBe(true);
    expect(bar.text()).toContain('Matemáticas — Grupo A');
    // 12 in the room minus the professor → 11 students.
    expect(bar.text()).toContain('11 estudiantes');
    expect(bar.text()).toContain('Twilio Video · WebRTC SFU');
  });

  it('shows the REC badge only while recording', () => {
    const recording = mount(<ProfessorRoomShell stage={<div>stage</div>} recording />);
    expect(recording.find('[data-testid="professor-room-shell-rec-badge"]').exists()).toBe(true);

    const idle = mount(<ProfessorRoomShell stage={<div>stage</div>} recording={false} />);
    expect(idle.find('[data-testid="professor-room-shell-rec-badge"]').exists()).toBe(false);
  });

  it('renders the group attention as a circular gauge', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} rightTab="grupo" />);
    const gauge = wrapper.find('[data-testid="professor-room-shell-gauge"]');
    expect(gauge.exists()).toBe(true);
    expect(gauge.text()).toContain('64');
    expect(gauge.text()).toContain('/ 100');
  });

  it('renders the roster from real room participants, decorated with attention data when available', () => {
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        participants={[
          { identity: 'Ana García' }, // has attention data (high)
          { identity: 'María Torres' }, // has attention data (multiface)
          { identity: 'Estudiante Real' }, // no attention data → no badge
          { identity: 'Profe X [Profesor]' },
        ]}
      />
    );

    const roster = wrapper.find('[data-testid="professor-room-shell-roster"]');
    expect(roster.text()).toContain('Ana García');
    expect(roster.text()).toContain('María Torres');
    expect(roster.text()).toContain('Estudiante Real');
    // The teacher renders without the raw [Profesor] suffix; the role shows as a badge instead.
    expect(roster.text()).toContain('Profe X');
    expect(roster.text()).not.toContain('[Profesor]');
    expect(wrapper.find('[data-testid="role-badge-teacher"]').exists()).toBe(true);
    // Present in the attention mock but NOT in the room → must not appear.
    expect(roster.text()).not.toContain('Carlos López');
    expect(wrapper.find('[data-testid="professor-room-shell-multiface-flag"]').length).toBe(1);
    // Attention badges render only for identities the attention pipeline knows about.
    expect(wrapper.find('[data-testid="professor-room-shell-attention-badge"]').length).toBe(2);
  });

  it('shows a camera-off flag next to a camera-off student in the roster', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      participants: [
        { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false, cameraOff: false },
        { identity: 'Carlos López', index: 91, level: 'high' as const, multiface: false, cameraOff: true },
      ],
    }));
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        participants={[{ identity: 'Ana García' }, { identity: 'Carlos López' }]}
      />
    );
    expect(wrapper.find('[data-testid="professor-room-shell-cameraoff-flag"]').length).toBe(1);
  });

  it('suppresses the attention badge for a camera-off student', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      participants: [
        { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false, cameraOff: false },
        { identity: 'Carlos López', index: 91, level: 'high' as const, multiface: false, cameraOff: true },
      ],
    }));
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        participants={[{ identity: 'Ana García' }, { identity: 'Carlos López' }]}
      />
    );
    // Only Ana García (camera on) keeps the attention level badge.
    expect(wrapper.find('[data-testid="professor-room-shell-attention-badge"]').length).toBe(1);
  });

  it('renders an empty roster when no participants are provided', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} />);
    const roster = wrapper.find('[data-testid="professor-room-shell-roster"]');
    expect(roster.children().length).toBe(0);
  });

  it('shows the hands-raised queue only when hands are up', () => {
    const without = mount(<ProfessorRoomShell stage={<div>stage</div>} />);
    expect(without.find('[data-testid="professor-room-shell-hands-queue"]').exists()).toBe(false);

    const withHands = mount(<ProfessorRoomShell stage={<div>stage</div>} handsRaised={['Carlos López']} />);
    const queue = withHands.find('[data-testid="professor-room-shell-hands-queue"]');
    expect(queue.exists()).toBe(true);
    expect(queue.text()).toContain('Manos levantadas (1)');
    expect(queue.text()).toContain('Carlos López');
  });

  it('gives a student the turn from the hands-raised queue', () => {
    const onGrantTurn = jest.fn();
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        handsRaised={['Carlos López', 'Sofía Ruiz']}
        onGrantTurn={onGrantTurn}
      />
    );
    const grantButtons = wrapper.findWhere(node => node.type() === 'button' && node.text() === 'Dar turno');
    expect(grantButtons.length).toBe(2);

    grantButtons.first().simulate('click');
    expect(onGrantTurn).toHaveBeenCalledWith('Carlos López');
  });

  it('does not render a moderation kebab without an onMuteParticipant handler', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} participants={[{ identity: 'Ana García' }]} />);
    expect(wrapper.find('[data-testid="professor-room-shell-roster-menu-button"]').exists()).toBe(false);
  });

  it('renders a moderation kebab for students only, never the professor', () => {
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        onMuteParticipant={jest.fn()}
        participants={[{ identity: 'Ana García' }, { identity: 'Carlos López' }, { identity: 'Profe X [Profesor]' }]}
      />
    );
    // Two students get a kebab; the professor's own row does not.
    expect(wrapper.find('button[data-testid="professor-room-shell-roster-menu-button"]').length).toBe(2);
  });

  it('mutes a student from the roster kebab menu', () => {
    const onMuteParticipant = jest.fn();
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        onMuteParticipant={onMuteParticipant}
        participants={[{ identity: 'Ana García' }]}
      />
    );
    // The menu is closed until the kebab is clicked.
    expect(wrapper.find('[data-testid="professor-room-shell-roster-menu"]').exists()).toBe(false);

    wrapper
      .find('button[data-testid="professor-room-shell-roster-menu-button"]')
      .first()
      .simulate('click');
    wrapper.update();
    expect(wrapper.find('[data-testid="professor-room-shell-roster-menu"]').exists()).toBe(true);

    wrapper
      .find('button[data-testid="professor-room-shell-roster-mute"]')
      .first()
      .simulate('click');
    expect(onMuteParticipant).toHaveBeenCalledWith('Ana García');
    // Menu closes after the action.
    wrapper.update();
    expect(wrapper.find('[data-testid="professor-room-shell-roster-menu"]').exists()).toBe(false);
  });

  it('shows the group-below-threshold banner when group attention is under the threshold', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} />);
    expect(wrapper.find('[data-testid="professor-room-shell-group-banner"]').exists()).toBe(true);

    mockUseAttention.mockImplementation(() => ({ ...baseAttention, groupAttention: 90 }));
    const healthy = mount(<ProfessorRoomShell stage={<div>stage</div>} />);
    expect(healthy.find('[data-testid="professor-room-shell-group-banner"]').exists()).toBe(false);
  });

  it('renders the no-data state honestly when no attention reading is available', () => {
    // groupAttention 0 + groupDataAvailable false = low connection / no measured
    // students. The gauge must read "—" (not 0), show the neutral no-data banner,
    // and NEVER raise the red below-threshold alarm.
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      groupAttention: 0,
      groupDataAvailable: false,
    }));
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} />);

    const gaugeText = wrapper.find('[data-testid="professor-room-shell-group-gauge"]').text();
    expect(gaugeText).toContain('—');
    expect(gaugeText).not.toContain('0 / 100');
    expect(wrapper.find('[data-testid="professor-room-shell-group-nodata-banner"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-room-shell-group-banner"]').exists()).toBe(false);
  });

  it('defaults to the group tab and switches to the individual tab', () => {
    const onRightTabChange = jest.fn();
    const wrapper = mount(
      <ProfessorRoomShell stage={<div>stage</div>} rightTab="grupo" onRightTabChange={onRightTabChange} />
    );

    expect(wrapper.find('[data-testid="professor-room-shell-group-gauge"]').text()).toContain('64');
    expect(wrapper.find('[data-testid="professor-room-shell-individual-list"]').exists()).toBe(false);

    wrapper.find('[data-testid="professor-room-shell-tab-individual"]').simulate('click');
    expect(onRightTabChange).toHaveBeenCalledWith('individual');
  });

  it('switches to the chat tab', () => {
    const onRightTabChange = jest.fn();
    const wrapper = mount(
      <ProfessorRoomShell stage={<div>stage</div>} rightTab="grupo" onRightTabChange={onRightTabChange} />
    );

    wrapper.find('[data-testid="professor-room-shell-tab-chat"]').simulate('click');
    expect(onRightTabChange).toHaveBeenCalledWith('chat');
  });

  it('renders the rightPanel node when the chat tab is active', () => {
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        rightTab="chat"
        rightPanel={<div data-testid="chat-panel-content">chat</div>}
      />
    );

    expect(wrapper.find('[data-testid="chat-panel-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-room-shell-group-gauge"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="professor-room-shell-individual-list"]').exists()).toBe(false);
  });

  it('renders the individual attention list when the individual tab is active', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} rightTab="individual" />);

    const list = wrapper.find('[data-testid="professor-room-shell-individual-list"]');
    expect(list.exists()).toBe(true);
    expect(list.text()).toContain('Ana García');
    expect(list.text()).toContain('85');
  });

  it('shows a muted camera-off state in the individual tab for a camera-off student', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      participants: [
        { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false, cameraOff: false },
        { identity: 'Carlos López', index: 91, level: 'high' as const, multiface: false, cameraOff: true },
      ],
    }));
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} rightTab="individual" />);
    const list = wrapper.find('[data-testid="professor-room-shell-individual-list"]');
    expect(list.text()).toContain('Cámara apagada');
    // The stale 91 percentage must not be shown for the camera-off student.
    expect(wrapper.find('[data-testid="professor-room-shell-individual-cameraoff"]').length).toBe(1);
  });

  it('shows "Sin medición" in the individual tab when a student\'s face is not detected', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      participants: [
        { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false, cameraOff: false, faces: 1 },
        // Face not detected → index 0 is a placeholder, must read "sin medición", not "0".
        { identity: 'Heather', index: 0, level: 'low' as const, multiface: false, cameraOff: false, faces: 0 },
      ],
    }));
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} rightTab="individual" />);
    const list = wrapper.find('[data-testid="professor-room-shell-individual-list"]');
    expect(list.text()).toContain('Sin medición');
    expect(wrapper.find('[data-testid="professor-room-shell-individual-nomeasure"]').length).toBe(1);
  });

  it('shows "Analizando…" (not "Cámara apagada") for a student whose analysis has no reading yet', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      participants: [
        { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false, cameraOff: false, faces: 1 },
        {
          identity: 'Luis',
          index: 0,
          level: 'low' as const,
          multiface: false,
          cameraOff: false,
          faces: 0,
          pending: true,
        },
      ],
    }));
    const wrapper = mount(
      <ProfessorRoomShell
        stage={<div>stage</div>}
        rightTab="individual"
        participants={[{ identity: 'Ana García' }, { identity: 'Luis' }]}
      />
    );
    const list = wrapper.find('[data-testid="professor-room-shell-individual-list"]');
    expect(list.text()).toContain('Analizando');
    expect(list.text()).not.toContain('Cámara apagada');
    expect(wrapper.find('[data-testid="professor-room-shell-individual-pending"]').length).toBe(1);
    expect(wrapper.find('[data-testid="professor-room-shell-pending-flag"]').length).toBe(1);
    expect(wrapper.find('[data-testid="professor-room-shell-cameraoff-flag"]').length).toBe(0);
  });

  it('shows "No medible (celular)" in the individual tab for a mobile student', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      participants: [
        { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false, cameraOff: false, faces: 1 },
        { identity: 'Matiu', index: 0, level: 'low' as const, multiface: false, cameraOff: false, unsupported: true },
      ],
    }));
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} rightTab="individual" />);
    const list = wrapper.find('[data-testid="professor-room-shell-individual-list"]');
    expect(list.text()).toContain('No medible');
    expect(wrapper.find('[data-testid="professor-room-shell-individual-unsupported"]').length).toBe(1);
  });

  it('renders the mocked proctoring alerts feed when proctoring is enabled', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} proctoringEnabled />);

    const feed = wrapper.find('[data-testid="professor-room-shell-proctoring-feed"]');
    expect(feed.exists()).toBe(true);
    expect(feed.text()).toContain('Alertas de proctoring (2)');
    expect(feed.text()).toContain('María Torres');
    expect(feed.text()).toContain('Múltiples rostros');
    expect(feed.text()).toContain('Distraído');
    // The detected time identifies the event; the meaningless confidence % is gone.
    expect(feed.text()).toContain('10:22');
    expect(feed.text()).not.toContain('91%');
  });

  it('hides the proctoring feed when proctoring is disabled', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} proctoringEnabled={false} />);
    expect(wrapper.find('[data-testid="professor-room-shell-proctoring-feed"]').exists()).toBe(false);
  });

  it('shows camera-off copy in the proctoring modal for a camera-off alert', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      proctoringAlerts: [
        {
          id: 'live-cameraoff-Carlos López',
          identity: 'Carlos López',
          kind: 'camera-off' as const,
          detectedAt: '10:40',
          confidence: 1.0,
        },
      ],
    }));
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} proctoringEnabled />);
    const feed = wrapper.find('[data-testid="professor-room-shell-proctoring-feed"]');
    expect(feed.text()).toContain('Cámara apagada');

    wrapper
      .find('[data-testid="professor-room-shell-proctoring-feed"]')
      .find('[role="button"]')
      .first()
      .simulate('click');
    wrapper.update();
    const modal = wrapper.find('[data-testid="professor-proctoring-modal"]');
    expect(modal.exists()).toBe(true);
    expect(modal.text()).toContain('Cámara apagada');
    // Multiface copy must not leak into a camera-off modal.
    expect(modal.text()).not.toContain('Se detectaron 2 rostros');
    // The dead sensitivity slider was removed.
    expect(wrapper.find('[data-testid="professor-proctoring-modal-slider"]').exists()).toBe(false);
    expect(modal.text()).not.toContain('Umbral de sensibilidad');
  });

  const multifaceAlertAttention = {
    ...baseAttention,
    proctoringAlerts: [
      { id: 'alert-mf', identity: 'María Torres', kind: 'multiface' as const, detectedAt: '10:22', confidence: 0.91 },
    ],
  };

  const openFirstAlert = (wrapper: ReturnType<typeof mount>) => {
    wrapper
      .find('[data-testid="professor-room-shell-proctoring-feed"]')
      .find('[role="button"]')
      .first()
      .simulate('click');
    wrapper.update();
  };

  it('sends a warning targeted at the student identity and kind, then dismisses the alert', () => {
    mockUseAttention.mockImplementation(() => multifaceAlertAttention);
    const onSendWarning = jest.fn();
    const wrapper = mount(
      <ProfessorRoomShell stage={<div>stage</div>} proctoringEnabled onSendWarning={onSendWarning} />
    );
    openFirstAlert(wrapper);

    wrapper
      .find('[data-testid="professor-proctoring-modal-warning"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(onSendWarning).toHaveBeenCalledWith('María Torres', 'multiface');
    // Modal closes and the handled alert leaves the feed.
    expect(wrapper.find('[data-testid="professor-proctoring-modal"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="professor-room-shell-proctoring-feed"]').text()).toContain(
      'Alertas de proctoring (0)'
    );
  });

  it('marking an alert as legitimate dismisses it without sending a warning', () => {
    mockUseAttention.mockImplementation(() => multifaceAlertAttention);
    const onSendWarning = jest.fn();
    const wrapper = mount(
      <ProfessorRoomShell stage={<div>stage</div>} proctoringEnabled onSendWarning={onSendWarning} />
    );
    openFirstAlert(wrapper);

    wrapper
      .find('[data-testid="professor-proctoring-modal-legitimate"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(onSendWarning).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="professor-proctoring-modal"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="professor-room-shell-proctoring-feed"]').text()).toContain(
      'Alertas de proctoring (0)'
    );
  });

  describe('live report modal (Feature 3)', () => {
    it('opens the in-room report modal fed by live attention data, instead of a snackbar', () => {
      const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} sessionName="Clase de Historia" />);

      expect(wrapper.find('[data-testid="professor-live-report-modal"]').exists()).toBe(false);

      wrapper.find('[data-testid="professor-room-shell-view-report"]').simulate('click');
      wrapper.update();

      expect(mockEnqueue).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="professor-live-report-modal"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="attention-report-summary"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Clase de Historia');
    });

    it('closes the modal from its header close button', () => {
      const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} />);

      wrapper.find('[data-testid="professor-room-shell-view-report"]').simulate('click');
      wrapper.update();
      expect(wrapper.find('[data-testid="professor-live-report-modal"]').exists()).toBe(true);

      wrapper
        .find('[data-testid="professor-live-report-modal-close"]')
        .first()
        .simulate('click');
      wrapper.update();

      expect(wrapper.find('[data-testid="professor-live-report-modal"]').exists()).toBe(false);
    });
  });
});
