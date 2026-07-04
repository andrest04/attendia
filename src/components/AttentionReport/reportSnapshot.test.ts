import { saveReportSnapshot, loadReportSnapshot, REPORT_SNAPSHOT_KEY } from './reportSnapshot';
import { AttentionReportViewData } from './AttentionReportView';

const sampleData: AttentionReportViewData = {
  sessionName: 'Matemáticas — Grupo A',
  studentCount: 3,
  source: 'live',
  attentionThreshold: 60,
  timeline: [{ time: '10:00', value: 70 }],
  hasGroupData: true,
  groupAverage: 70,
  percentAboveThreshold: 100,
  participants: [{ identity: 'Ana', indexAvg: 80, level: 'high', alertCount: 0 }],
  totalAlerts: 0,
  reportDate: new Date('2026-06-27T16:10:00Z'),
};

describe('reportSnapshot', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the report data through localStorage', () => {
    saveReportSnapshot(sampleData);
    const loaded = loadReportSnapshot();
    expect(loaded).toMatchObject({
      sessionName: 'Matemáticas — Grupo A',
      groupAverage: 70,
      participants: [{ identity: 'Ana', indexAvg: 80 }],
    });
  });

  it('revives reportDate as a Date instance, not a string', () => {
    saveReportSnapshot(sampleData);
    const loaded = loadReportSnapshot();
    expect(loaded!.reportDate).toBeInstanceOf(Date);
    expect(loaded!.reportDate.getTime()).toBe(sampleData.reportDate.getTime());
  });

  it('returns null when there is no snapshot', () => {
    expect(loadReportSnapshot()).toBeNull();
  });

  it('returns null (not a throw) when the stored value is corrupt', () => {
    localStorage.setItem(REPORT_SNAPSHOT_KEY, '{ not valid json');
    expect(loadReportSnapshot()).toBeNull();
  });
});
