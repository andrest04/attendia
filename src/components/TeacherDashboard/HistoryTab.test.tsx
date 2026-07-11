import React from 'react';
import { mount } from 'enzyme';
import HistoryTab from './HistoryTab';

const reports: any[] = [
  {
    roomSid: 'RM00000000000000000000000000000abc',
    roomName: 'Matemáticas Grupo B',
    endReason: 'ended-for-all',
    source: 'live',
    studentCount: 26,
    attentionThreshold: 60,
    ranges: { lowMax: 40, mediumMax: 70 },
    groupAverage: 91,
    percentAboveThreshold: 80,
    timeline: [],
    participants: [],
    proctoringAlerts: [],
    startedAtIso: '2026-07-02T09:00:00.000Z',
    endedAtIso: '2026-07-02T10:02:00.000Z',
    endedAtMs: 1782986520000,
    durationMs: 3720000,
    recordingWasActiveAtEnd: true,
  },
  {
    roomSid: 'RM00000000000000000000000000000def',
    roomName: 'Cálculo III',
    endReason: 'left',
    source: 'mock',
    studentCount: 24,
    attentionThreshold: 60,
    ranges: { lowMax: 40, mediumMax: 70 },
    groupAverage: 35,
    percentAboveThreshold: 20,
    timeline: [],
    participants: [],
    proctoringAlerts: [],
    startedAtIso: '2026-07-04T09:00:00.000Z',
    endedAtIso: '2026-07-04T09:58:00.000Z',
    endedAtMs: 1783159080000,
    durationMs: 3480000,
    recordingWasActiveAtEnd: false,
  },
];

describe('HistoryTab', () => {
  const props = { reports, isLoading: false, error: null, onRetry: jest.fn(), onOpenReport: jest.fn() };

  it('renders persisted duration, disclosed mock attention, and no invented recording download', () => {
    const wrapper = mount(<HistoryTab {...props} />);

    expect(wrapper.find('[data-testid="dashboard-history-row-RM00000000000000000000000000000abc"]').text()).toContain(
      '1h 2min'
    );
    expect(wrapper.find('[data-testid="dashboard-history-row-RM00000000000000000000000000000def"]').text()).toContain(
      'Datos simulados'
    );
    expect(wrapper.text()).toContain('Activa al cierre (archivo no disponible)');
    expect(wrapper.text()).toContain('No disponible');
    expect(wrapper.find('[data-testid="dashboard-history-download"]').exists()).toBe(false);
  });

  it('filters reports and opens the selected persisted report', () => {
    const onOpenReport = jest.fn();
    const wrapper = mount(<HistoryTab {...props} onOpenReport={onOpenReport} />);

    wrapper.find('input[aria-label="Buscar clase"]').simulate('change', { target: { value: 'cálculo' } });
    expect(wrapper.find('[data-testid="dashboard-history-row-RM00000000000000000000000000000abc"]').exists()).toBe(
      false
    );
    wrapper.find('[data-testid="dashboard-history-report"]').simulate('click');
    expect(onOpenReport).toHaveBeenCalledWith(reports[1]);
  });

  it('renders loading, error retry, and empty states', () => {
    const loading = mount(<HistoryTab {...props} reports={null} isLoading />);
    expect(loading.find('[data-testid="dashboard-history-loading"]').exists()).toBe(true);

    const onRetry = jest.fn();
    const error = mount(<HistoryTab {...props} reports={null} error="No disponible" onRetry={onRetry} />);
    error
      .find('[data-testid="dashboard-history-retry"]')
      .first()
      .simulate('click');
    expect(onRetry).toHaveBeenCalledTimes(1);

    const empty = mount(<HistoryTab {...props} reports={[]} />);
    expect(empty.find('[data-testid="dashboard-history-empty"]').exists()).toBe(true);
  });
});
