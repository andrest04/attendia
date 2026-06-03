import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import AttentionReportOverlay from './AttentionReportOverlay';
import { useAttention } from '../../AttentionProvider';
import { exportAttentionReport } from '../ProfessorRoomShell/exportAttentionReport';

jest.mock('../../AttentionProvider');
jest.mock('../ProfessorRoomShell/exportAttentionReport', () => ({
  exportAttentionReport: jest.fn(() => Promise.resolve()),
}));
// recharts' ResponsiveContainer needs a measurable parent; stub it out for jsdom.
jest.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    AreaChart: Stub,
    Area: Stub,
    XAxis: Stub,
    YAxis: Stub,
    Tooltip: Stub,
    ReferenceLine: Stub,
  };
});

const mockUseAttention = useAttention as jest.Mock<any>;
const mockExport = exportAttentionReport as jest.Mock;

const attentionLevel = (score: number): 'high' | 'medium' | 'low' => {
  if (score <= 40) return 'low';
  if (score <= 70) return 'medium';
  return 'high';
};

const baseAttention = {
  source: 'mock' as const,
  groupAttention: 72,
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

describe('AttentionReportOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAttention.mockImplementation(() => baseAttention);
    mockExport.mockImplementation(() => Promise.resolve());
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

  it('calls onClose when the Cerrar button is clicked', () => {
    const onClose = jest.fn();
    const wrapper = renderOverlay({ onClose });
    wrapper
      .find('[data-testid="attention-report-close"]')
      .first()
      .simulate('click');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('downloads a PDF with the current snapshot when "Descargar PDF" is clicked', () => {
    const wrapper = renderOverlay();
    wrapper
      .find('[data-testid="attention-report-download-pdf"]')
      .first()
      .simulate('click');
    expect(mockExport).toHaveBeenCalledTimes(1);
    expect(mockExport.mock.calls[0][0]).toBe('pdf');
    expect(mockExport.mock.calls[0][1]).toMatchObject({
      source: 'mock',
      groupAttention: 72,
      attentionThreshold: 60,
    });
    expect(mockExport.mock.calls[0][2]).toMatchObject({ sessionName: 'Matemáticas — Grupo A' });
  });

  it('downloads an Excel workbook when "Descargar Excel" is clicked', () => {
    const wrapper = renderOverlay();
    wrapper
      .find('[data-testid="attention-report-download-excel"]')
      .first()
      .simulate('click');
    expect(mockExport).toHaveBeenCalledTimes(1);
    expect(mockExport.mock.calls[0][0]).toBe('xlsx');
  });

  it('invokes onExportError and shows the snackbar when a download fails', async () => {
    mockExport.mockImplementation(() => Promise.reject(new Error('export failed')));
    const onExportError = jest.fn();
    const wrapper = renderOverlay({ onExportError });

    wrapper
      .find('[data-testid="attention-report-download-pdf"]')
      .first()
      .simulate('click');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    wrapper.update();

    expect(onExportError).toHaveBeenCalledTimes(1);
    expect(
      wrapper
        .find('[message="No se pudo generar el reporte"]')
        .first()
        .prop('open')
    ).toBe(true);
  });
});
