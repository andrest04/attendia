import React from 'react';
import { mount } from 'enzyme';
import ProfessorRoomShell from './ProfessorRoomShell';
import { useAttention } from '../../AttentionProvider';

jest.mock('../../AttentionProvider');
// recharts' ResponsiveContainer needs a measurable parent; stub it out for jsdom.
jest.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    AreaChart: Stub,
    Area: Stub,
    LineChart: Stub,
    Line: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
  };
});

const mockUseAttention = useAttention as jest.Mock<any>;

const attentionLevel = (score: number): 'high' | 'medium' | 'low' => {
  if (score <= 40) return 'low';
  if (score <= 70) return 'medium';
  return 'high';
};

const baseAttention = {
  groupAttention: 64,
  attentionThreshold: 70,
  timeline: [
    { time: '0:00', value: 88 },
    { time: '0:05', value: 64 },
  ],
  participants: [
    { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false },
    { identity: 'Carlos López', index: 60, level: 'medium' as const, multiface: false },
    { identity: 'María Torres', index: 35, level: 'low' as const, multiface: true },
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
    expect(wrapper.find('[data-testid="professor-room-shell-stage-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-room-shell-toolbar-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-room-shell-right-tabs"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stage-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="toolbar-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-room-shell-participant-count"]').text()).toContain('12 en sala');
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

  it('renders the roster with attention badges and multiface flags', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} />);

    const roster = wrapper.find('[data-testid="professor-room-shell-roster"]');
    expect(roster.text()).toContain('Ana García');
    expect(roster.text()).toContain('María Torres');
    expect(wrapper.find('[data-testid="professor-room-shell-multiface-flag"]').length).toBe(1);
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

  it('shows the group-below-threshold banner when group attention is under the threshold', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} />);
    expect(wrapper.find('[data-testid="professor-room-shell-group-banner"]').exists()).toBe(true);

    mockUseAttention.mockImplementation(() => ({ ...baseAttention, groupAttention: 90 }));
    const healthy = mount(<ProfessorRoomShell stage={<div>stage</div>} />);
    expect(healthy.find('[data-testid="professor-room-shell-group-banner"]').exists()).toBe(false);
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

  it('renders the individual attention list when the individual tab is active', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} rightTab="individual" />);

    const list = wrapper.find('[data-testid="professor-room-shell-individual-list"]');
    expect(list.exists()).toBe(true);
    expect(list.text()).toContain('Ana García');
    expect(list.text()).toContain('85');
  });

  it('renders the mocked proctoring alerts feed when proctoring is enabled', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} proctoringEnabled />);

    const feed = wrapper.find('[data-testid="professor-room-shell-proctoring-feed"]');
    expect(feed.exists()).toBe(true);
    expect(feed.text()).toContain('Alertas de proctoring (2)');
    expect(feed.text()).toContain('María Torres');
    expect(feed.text()).toContain('Múltiples rostros');
    expect(feed.text()).toContain('Ausente');
    expect(feed.text()).toContain('91%');
  });

  it('hides the proctoring feed when proctoring is disabled', () => {
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} proctoringEnabled={false} />);
    expect(wrapper.find('[data-testid="professor-room-shell-proctoring-feed"]').exists()).toBe(false);
  });

  it('opens the export menu and emits the chosen format', () => {
    const onExportReport = jest.fn();
    const wrapper = mount(<ProfessorRoomShell stage={<div>stage</div>} onExportReport={onExportReport} />);

    // The button only toggles the format menu; no export is emitted yet.
    wrapper.findWhere(node => node.type() === 'button' && node.text() === 'Exportar reporte').simulate('click');
    expect(onExportReport).not.toHaveBeenCalled();

    wrapper.update();
    wrapper.findWhere(node => node.type() === 'button' && node.text() === 'PDF').simulate('click');
    expect(onExportReport).toHaveBeenCalledWith('pdf');
  });
});
