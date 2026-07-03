import React from 'react';
import { mount } from 'enzyme';
import AttentionReportOverlay from './AttentionReportOverlay';
import { averageOverTime, percentTimeAboveThreshold } from '../../AttentionReport/reportMath';
import { useAttention } from '../../AttentionProvider';

jest.mock('../../AttentionProvider');
// recharts' ResponsiveContainer needs a measurable parent; stub it out for jsdom.
jest.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const VoidStub = () => null;
  return {
    ResponsiveContainer: Stub,
    AreaChart: Stub,
    Area: VoidStub,
    LineChart: Stub,
    Line: VoidStub,
    CartesianGrid: VoidStub,
    XAxis: VoidStub,
    YAxis: VoidStub,
    Tooltip: VoidStub,
    ReferenceLine: VoidStub,
  };
});

const mockUseAttention = useAttention as jest.Mock<any>;

const attentionLevel = (score: number): 'high' | 'medium' | 'low' => {
  if (score <= 40) return 'low';
  if (score <= 70) return 'medium';
  return 'high';
};

const baseAttention = {
  source: 'mock' as const,
  groupAttention: 72,
  groupDataAvailable: true,
  attentionThreshold: 60,
  timeline: [
    { time: '10:00', value: 68 },
    { time: '10:05', value: 71 },
  ],
  participants: [
    { identity: 'Ana García', index: 85, level: 'high' as const, multiface: false },
    { identity: 'Carlos López', index: 60, level: 'medium' as const, multiface: false },
    { identity: 'María Torres', index: 35, level: 'low' as const, multiface: true },
  ],
  proctoringAlerts: [
    { id: 'alert-001', identity: 'María Torres', kind: 'multiface' as const, detectedAt: '10:22', confidence: 0.91 },
  ],
  attentionLevel,
};

function renderOverlay(props: Partial<React.ComponentProps<typeof AttentionReportOverlay>> = {}) {
  return mount(
    <AttentionReportOverlay
      isOpen
      onClose={jest.fn()}
      sessionName="Matemáticas — Grupo A"
      studentCount={5}
      {...props}
    />
  );
}

describe('report metric helpers', () => {
  it('averageOverTime rounds the mean of timeline values', () => {
    expect(
      averageOverTime([
        { time: 'a', value: 60 },
        { time: 'b', value: 80 },
      ])
    ).toBe(70);
  });

  it('averageOverTime returns 0 for an empty timeline', () => {
    expect(averageOverTime([])).toBe(0);
  });

  it('percentTimeAboveThreshold counts points at or above the threshold', () => {
    const tl = [
      { time: 'a', value: 40 },
      { time: 'b', value: 60 },
      { time: 'c', value: 75 },
      { time: 'd', value: 90 },
    ];
    // 3 of 4 points >= 60 → 75%
    expect(percentTimeAboveThreshold(tl, 60)).toBe(75);
  });

  it('percentTimeAboveThreshold returns 0 for an empty timeline', () => {
    expect(percentTimeAboveThreshold([], 60)).toBe(0);
  });
});

describe('AttentionReportOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAttention.mockImplementation(() => baseAttention);
  });

  it('shows the per-student min, max and average from history', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      participants: [
        {
          identity: 'Ana García',
          index: 85,
          level: 'high' as const,
          multiface: false,
          indexMin: 70,
          indexMax: 95,
          indexAvg: 83,
        },
      ],
    }));
    const table = renderOverlay().find('[data-testid="attention-report-table"]');
    expect(table.text()).toContain('70'); // min
    expect(table.text()).toContain('95'); // max
    expect(table.text()).toContain('83'); // avg
  });

  it('falls back to a dash for min/max when a participant has no history', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      participants: [{ identity: 'Sin Historial', index: 50, level: 'medium' as const, multiface: false }],
    }));
    const table = renderOverlay().find('[data-testid="attention-report-table"]');
    expect(table.text()).toContain('—');
  });

  it('computes "Umbral superado" as the % of time at/above threshold, not the threshold constant', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      attentionThreshold: 60,
      timeline: [
        { time: 'a', value: 40 },
        { time: 'b', value: 80 },
        { time: 'c', value: 90 },
        { time: 'd', value: 95 },
      ],
    }));
    const summary = renderOverlay().find('[data-testid="attention-report-summary"]');
    // 3 of 4 ≥ 60 → 75%, NOT the threshold value 60%
    expect(summary.text()).toContain('75%');
  });

  it('shows the group average over time, not the instantaneous snapshot', () => {
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      groupAttention: 100, // instantaneous snapshot
      timeline: [
        { time: 'a', value: 60 },
        { time: 'b', value: 80 },
      ], // time-average 70
    }));
    const summary = renderOverlay().find('[data-testid="attention-report-summary"]');
    expect(summary.text()).toContain('70');
  });

  it('shows a dash for the group KPIs when the session recorded no data at all', () => {
    // No timeline history AND no live reading (report opened during a connection
    // drop before any data was captured) → group average and "Umbral superado"
    // must read "—", never a placeholder 0 that implies "the group had 0%".
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      groupAttention: 0,
      groupDataAvailable: false,
      timeline: [],
    }));
    const summary = renderOverlay().find('[data-testid="attention-report-summary"]');
    expect(summary.text()).toContain('—');
    expect(summary.text()).not.toContain('0 / 100');
  });

  it('still shows recorded history even if currently disconnected', () => {
    // groupDataAvailable false (offline now) but the session DID accumulate data →
    // the report reflects the real history, not a dash.
    mockUseAttention.mockImplementation(() => ({
      ...baseAttention,
      groupDataAvailable: false,
      timeline: [
        { time: 'a', value: 60 },
        { time: 'b', value: 80 },
      ], // time-average 70
    }));
    const summary = renderOverlay().find('[data-testid="attention-report-summary"]');
    expect(summary.text()).toContain('70');
  });

  it('renders nothing when closed', () => {
    const wrapper = mount(
      <AttentionReportOverlay isOpen={false} onClose={jest.fn()} sessionName="Sesión" studentCount={3} />
    );
    expect(wrapper.find('[data-testid="attention-report-overlay"]').exists()).toBe(false);
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('renders the title and all report sections when open', () => {
    const wrapper = renderOverlay();
    expect(wrapper.find('[data-testid="attention-report-overlay"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Reporte de Atención');
    expect(wrapper.find('[data-testid="attention-report-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="attention-report-timeline"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="attention-report-table"]').exists()).toBe(true);
  });

  it('renders the session name and student count in the header', () => {
    const wrapper = renderOverlay();
    expect(wrapper.text()).toContain('Matemáticas — Grupo A');
    expect(wrapper.text()).toContain('5 estudiantes');
  });

  it('renders each participant in the per-student table', () => {
    const table = renderOverlay().find('[data-testid="attention-report-table"]');
    expect(table.text()).toContain('Ana García');
    expect(table.text()).toContain('Carlos López');
    expect(table.text()).toContain('María Torres');
  });

  it('shows the mock-disclosure tag when the data source is mock', () => {
    const wrapper = renderOverlay();
    expect(wrapper.text()).toContain('Datos simulados — pipeline CV pendiente');
  });

  it('does not show the mock-disclosure tag for live data', () => {
    mockUseAttention.mockImplementation(() => ({ ...baseAttention, source: 'live' }));
    const wrapper = renderOverlay();
    expect(wrapper.text()).not.toContain('Datos simulados — pipeline CV pendiente');
  });

  it('calls onClose when the "Volver a la sesión" button is clicked', () => {
    const onClose = jest.fn();
    const wrapper = renderOverlay({ onClose });
    wrapper
      .find('[data-testid="attention-report-close"]')
      .first()
      .simulate('click');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the X close button (top-right) is clicked', () => {
    const onClose = jest.fn();
    const wrapper = renderOverlay({ onClose });
    wrapper
      .find('[data-testid="attention-report-close-x"]')
      .first()
      .simulate('click');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = jest.fn();
    renderOverlay({ onClose });
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render "Nueva sesión" as a button label', () => {
    const wrapper = renderOverlay();
    expect(wrapper.text()).not.toContain('Nueva sesión');
  });

  it('does not render any download buttons (overlay is view-only)', () => {
    const wrapper = renderOverlay();
    expect(wrapper.find('[data-testid="attention-report-download-pdf"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="attention-report-download-csv"]').exists()).toBe(false);
  });
});
