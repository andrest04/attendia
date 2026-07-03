import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount, ReactWrapper } from 'enzyme';
import ClassHistoryPage from './ClassHistoryPage';
import { useAppState } from '../../state';

jest.mock('../../state');

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  useHistory: () => ({ push: mockHistoryPush }),
}));

// recharts' ResponsiveContainer needs a measurable parent; stub it out for jsdom.
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

const mockUseAppState = useAppState as jest.Mock<any>;

const teacherProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'teacher' };

const storedReport = {
  roomSid: 'RM00000000000000000000000000000abc',
  roomName: 'matematicas-2a',
  endReason: 'ended-for-all' as const,
  source: 'live' as const,
  studentCount: 3,
  attentionThreshold: 60,
  ranges: { lowMax: 40, mediumMax: 70 },
  groupAverage: 72,
  percentAboveThreshold: 80,
  timeline: [
    { time: '10:00:00', value: 68 },
    { time: '10:00:01', value: 76 },
  ],
  participants: [{ identity: 'Ana García', indexAvg: 83, indexMin: 70, indexMax: 95, level: 'high', alertCount: 1 }],
  proctoringAlerts: [{ identity: 'Ana García', kind: 'multiface', detectedAt: '10:02' }],
  endedAtIso: '2026-07-03T15:00:00.000Z',
  endedAtMs: 1751554800000,
};

async function renderPage(): Promise<ReactWrapper> {
  let wrapper: ReactWrapper = (undefined as unknown) as ReactWrapper;
  await act(async () => {
    wrapper = mount(<ClassHistoryPage />);
  });
  wrapper.update();
  return wrapper;
}

describe('the ClassHistoryPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the stored reports for a teacher', async () => {
    const mockFetch = jest.fn(() => Promise.resolve([storedReport]));
    mockUseAppState.mockImplementation(() => ({ profile: teacherProfile, fetchAttentionReports: mockFetch }));

    const wrapper = await renderPage();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const item = wrapper.find('[data-testid="class-history-item"]');
    expect(item.exists()).toBe(true);
    expect(item.text()).toContain('matematicas-2a');
    expect(item.text()).toContain('3 estudiantes');
    expect(item.text()).toContain('Promedio 72 / 100');
    expect(item.text()).toContain('1 alerta');
  });

  it('opens the stored report with the shared report view and returns to the list', async () => {
    const mockFetch = jest.fn(() => Promise.resolve([storedReport]));
    mockUseAppState.mockImplementation(() => ({ profile: teacherProfile, fetchAttentionReports: mockFetch }));

    const wrapper = await renderPage();

    wrapper
      .find('[data-testid="class-history-item"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="attention-report-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="attention-report-table"]').text()).toContain('Ana García');
    // The detail is rendered from memory — no second fetch.
    expect(mockFetch).toHaveBeenCalledTimes(1);

    wrapper
      .find('[data-testid="class-history-detail-back"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="attention-report-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="class-history-item"]').exists()).toBe(true);
  });

  it('shows the empty state when the teacher has no stored reports', async () => {
    // NOTE: the fetch mock must be a stable reference — a new jest.fn() per
    // useAppState() call re-triggers the fetch effect on every render, forever.
    const mockFetch = jest.fn(() => Promise.resolve([]));
    mockUseAppState.mockImplementation(() => ({ profile: teacherProfile, fetchAttentionReports: mockFetch }));

    const wrapper = await renderPage();

    expect(wrapper.find('[data-testid="class-history-empty"]').exists()).toBe(true);
  });

  it('shows the unavailable card for a student without fetching', async () => {
    const mockFetch = jest.fn(() => Promise.resolve([]));
    mockUseAppState.mockImplementation(() => ({
      profile: { ...teacherProfile, role: 'student' },
      fetchAttentionReports: mockFetch,
    }));

    const wrapper = await renderPage();

    expect(wrapper.find('[data-testid="class-history-unavailable"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('El historial de clases solo está disponible para profesores.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows the unavailable card when the auth mode does not expose fetchAttentionReports', async () => {
    mockUseAppState.mockImplementation(() => ({ profile: teacherProfile }));

    const wrapper = await renderPage();

    expect(wrapper.find('[data-testid="class-history-unavailable"]').exists()).toBe(true);
  });

  it('shows the error state and retries on demand', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockFetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('No pudimos consultar el historial de clases. Intenta de nuevo.'))
      .mockResolvedValueOnce([storedReport]);
    mockUseAppState.mockImplementation(() => ({ profile: teacherProfile, fetchAttentionReports: mockFetch }));

    const wrapper = await renderPage();

    const errorCard = wrapper.find('[data-testid="class-history-error"]');
    expect(errorCard.exists()).toBe(true);
    expect(errorCard.text()).toContain('No pudimos consultar el historial de clases.');

    await act(async () => {
      wrapper
        .find('[data-testid="class-history-retry"]')
        .first()
        .simulate('click');
    });
    wrapper.update();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-testid="class-history-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="class-history-item"]').exists()).toBe(true);
    consoleError.mockRestore();
  });

  it('navigates back to the lobby from the nav bar', async () => {
    const mockFetch = jest.fn(() => Promise.resolve([]));
    mockUseAppState.mockImplementation(() => ({ profile: teacherProfile, fetchAttentionReports: mockFetch }));

    const wrapper = await renderPage();

    wrapper
      .find('[data-testid="class-history-back-to-lobby"]')
      .first()
      .simulate('click');

    expect(mockHistoryPush).toHaveBeenCalledWith('/');
  });
});
