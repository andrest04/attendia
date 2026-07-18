import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
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
  {
    roomSid: 'RM00000000000000000000000000000ghi',
    roomName: 'test',
    endReason: 'ended-for-all',
    source: 'live',
    studentCount: 0,
    attentionThreshold: 60,
    ranges: { lowMax: 40, mediumMax: 70 },
    groupAverage: 0,
    percentAboveThreshold: 0,
    timeline: [],
    participants: [],
    proctoringAlerts: [],
    startedAtIso: '2026-07-13T09:00:00.000Z',
    endedAtIso: '2026-07-13T09:00:05.000Z',
    endedAtMs: 1789289405000,
    durationMs: 5000,
    recordingWasActiveAtEnd: false,
  },
];

describe('HistoryTab', () => {
  const props = {
    reports,
    isLoading: false,
    error: null,
    onRetry: jest.fn(),
    onOpenReport: jest.fn(),
    onRequestRecording: jest.fn(() => Promise.resolve({ status: 'enqueued' as const })),
    onCheckRecordingStatus: jest.fn(() => Promise.resolve({ status: 'processing' as const })),
  };

  afterEach(() => jest.clearAllMocks());

  it('renders persisted duration, disclosed mock attention, a request-recording action, and "No disponible" for the other row', () => {
    const wrapper = mount(<HistoryTab {...props} />);

    expect(wrapper.find('[data-testid="dashboard-history-row-RM00000000000000000000000000000abc"]').text()).toContain(
      '1h 2min'
    );
    expect(wrapper.find('[data-testid="dashboard-history-row-RM00000000000000000000000000000def"]').text()).toContain(
      'Datos simulados'
    );
    expect(
      wrapper.find('[data-testid="dashboard-history-recording-request-RM00000000000000000000000000000abc"]').exists()
    ).toBe(true);
    expect(wrapper.text()).toContain('No disponible');
    expect(
      wrapper.find('[data-testid="dashboard-history-row-RM00000000000000000000000000000ghi"]').text()
    ).toContain('5s');
    expect(
      wrapper.find('[data-testid="dashboard-history-recording-view-RM00000000000000000000000000000abc"]').exists()
    ).toBe(false);
  });

  it('requests a recording and reflects the enqueued status', async () => {
    const wrapper = mount(<HistoryTab {...props} />);

    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-history-recording-request-RM00000000000000000000000000000abc"]')
        .first()
        .simulate('click');
      await Promise.resolve();
      await Promise.resolve();
    });
    wrapper.update();

    expect(props.onRequestRecording).toHaveBeenCalledWith('RM00000000000000000000000000000abc');
    expect(
      wrapper.find('[data-testid="dashboard-history-recording-pending-RM00000000000000000000000000000abc"]').exists()
    ).toBe(true);
  });

  it('opens the standalone recording player for a completed recording', async () => {
    const completedReports = [{ ...reports[0], recording: { status: 'completed', mediaExpiresAt: Date.now() + 1000 } }];
    const windowOpen = jest.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = mount(<HistoryTab {...props} reports={completedReports as any} />);

    wrapper
      .find('[data-testid="dashboard-history-recording-view-RM00000000000000000000000000000abc"]')
      .first()
      .simulate('click');

    expect(windowOpen).toHaveBeenCalledWith(
      '/recording/RM00000000000000000000000000000abc',
      '_blank',
      'noopener'
    );
    windowOpen.mockRestore();
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
