import {
  clearPendingAttentionReports,
  getPendingAttentionReports,
  removePendingAttentionReport,
  savePendingAttentionReport,
} from './pendingAttentionReports';

const report = { roomSid: 'RM00000000000000000000000000000abc' } as any;

describe('pendingAttentionReports', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps durable retries separated by signed-in user', () => {
    savePendingAttentionReport('teacher-a', report);
    savePendingAttentionReport('teacher-b', { ...report, roomSid: 'RM00000000000000000000000000000def' });

    expect(getPendingAttentionReports('teacher-a')).toEqual([report]);
    expect(getPendingAttentionReports('teacher-b')).toHaveLength(1);
  });

  it('survives a tab-scoped storage reset so the dashboard can offer recovery after closure', () => {
    savePendingAttentionReport('teacher-a', report);
    window.sessionStorage.clear();

    expect(getPendingAttentionReports('teacher-a')).toEqual([report]);
  });

  it('replaces a stale retry for the same roomSid and removes it after a confirmed save', () => {
    savePendingAttentionReport('teacher-a', report);
    savePendingAttentionReport('teacher-a', { ...report, endReason: 'ended-for-all' });
    expect(getPendingAttentionReports('teacher-a')).toHaveLength(1);

    removePendingAttentionReport('teacher-a', report.roomSid);
    expect(getPendingAttentionReports('teacher-a')).toEqual([]);
  });

  it('clears pending sensitive data when that user signs out', () => {
    savePendingAttentionReport('teacher-a', report);
    clearPendingAttentionReports('teacher-a');
    expect(getPendingAttentionReports('teacher-a')).toEqual([]);
  });
});
