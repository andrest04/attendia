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

    expect(getPendingAttentionReports('teacher-a')).toEqual([expect.objectContaining({ report })]);
    expect(getPendingAttentionReports('teacher-b')).toHaveLength(1);
  });

  it('survives a tab-scoped storage reset so the dashboard can offer recovery after closure', () => {
    savePendingAttentionReport('teacher-a', report);
    window.sessionStorage.clear();

    expect(getPendingAttentionReports('teacher-a')).toEqual([expect.objectContaining({ report })]);
  });

  it('queues the report with one stable failure episode and advisory first-failure time', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1234);

    savePendingAttentionReport('teacher-a', report);
    const first = getPendingAttentionReports('teacher-a')[0];
    savePendingAttentionReport('teacher-a', { ...report, endReason: 'ended-for-all' });
    const retried = getPendingAttentionReports('teacher-a')[0];

    expect(first).toEqual(expect.objectContaining({ report, firstFailedAtMs: 1234 }));
    expect(first.failureEpisodeId).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(retried.failureEpisodeId).toBe(first.failureEpisodeId);
    expect(retried.firstFailedAtMs).toBe(1234);
    expect(retried.report.endReason).toBe('ended-for-all');
    now.mockRestore();
  });

  it('creates a distinct episode after recovery removes the resolved retry', () => {
    savePendingAttentionReport('teacher-a', report);
    const firstEpisodeId = getPendingAttentionReports('teacher-a')[0].failureEpisodeId;

    removePendingAttentionReport('teacher-a', report.roomSid);
    savePendingAttentionReport('teacher-a', report);

    expect(getPendingAttentionReports('teacher-a')[0].failureEpisodeId).not.toBe(firstEpisodeId);
  });

  it('ignores malformed persisted entries and bounds the queue', () => {
    window.localStorage.setItem(
      'twilio-video-pending-attention-reports',
      JSON.stringify({
        'teacher-a': [
          { report, failureEpisodeId: '../bad', firstFailedAtMs: 1 },
          ...new Array(25).fill(null).map((_, index) => ({
            report: { ...report, roomSid: `RM${String(index).padStart(32, '0')}` },
            failureEpisodeId: `episode_${String(index).padStart(8, '0')}`,
            firstFailedAtMs: index + 1,
          })),
        ],
      })
    );

    const pending = getPendingAttentionReports('teacher-a');
    expect(pending).toHaveLength(20);
    expect(pending.every(item => item.firstFailedAtMs > 0)).toBe(true);
  });

  it('clears pending sensitive data when that user signs out', () => {
    savePendingAttentionReport('teacher-a', report);
    clearPendingAttentionReports('teacher-a');
    expect(getPendingAttentionReports('teacher-a')).toEqual([]);
  });
});
