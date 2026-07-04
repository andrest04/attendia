import React from 'react';
import { mount } from 'enzyme';
import ReportPage from './ReportPage';
import { saveReportSnapshot } from '../AttentionReport/reportSnapshot';
import { AttentionReportViewData } from '../AttentionReport/AttentionReportView';

// recharts' ResponsiveContainer needs a measurable parent; stub it for jsdom.
jest.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const VoidStub = () => null;
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub,
    Line: VoidStub,
    CartesianGrid: VoidStub,
    XAxis: VoidStub,
    YAxis: VoidStub,
    Tooltip: VoidStub,
    ReferenceLine: VoidStub,
  };
});

const sampleData: AttentionReportViewData = {
  sessionName: 'Matemáticas — Grupo A',
  studentCount: 3,
  source: 'live',
  attentionThreshold: 60,
  timeline: [{ time: '10:00', value: 70 }],
  hasGroupData: true,
  groupAverage: 70,
  percentAboveThreshold: 100,
  participants: [{ identity: 'Ana García', indexAvg: 80, level: 'high', alertCount: 0 }],
  totalAlerts: 0,
  reportDate: new Date('2026-06-27T16:10:00Z'),
};

describe('ReportPage', () => {
  beforeEach(() => localStorage.clear());

  it('renders the report from the localStorage snapshot', () => {
    saveReportSnapshot(sampleData);
    const wrapper = mount(<ReportPage />);
    expect(wrapper.find('[data-testid="report-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="report-page-empty"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Reporte de Atención');
    expect(wrapper.text()).toContain('Matemáticas — Grupo A');
    expect(wrapper.text()).toContain('Ana García');
  });

  it('shows the empty state when there is no snapshot', () => {
    const wrapper = mount(<ReportPage />);
    expect(wrapper.find('[data-testid="report-page-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="attention-report-summary"]').exists()).toBe(false);
  });

  it('closes the tab from the Cerrar button', () => {
    const closeSpy = jest.spyOn(window, 'close').mockImplementation(() => undefined);
    const wrapper = mount(<ReportPage />);
    wrapper.find('[data-testid="report-page-close"]').simulate('click');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    closeSpy.mockRestore();
  });
});
