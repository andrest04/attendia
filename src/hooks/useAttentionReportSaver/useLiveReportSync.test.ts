import React from 'react';
import { act, renderHook } from '@testing-library/react-hooks';
import useLiveReportSync, { LIVE_PUSH_INTERVAL_MS, LIVE_RESTORE_RETRY_MS } from './useLiveReportSync';
import { AttentionRestoreContext } from '../../components/AttentionProvider';
import { useAppState } from '../../state';
import useVideoContext from '../useVideoContext/useVideoContext';
import { ClientApiError, createApiClient } from '../../state/useFirebaseAuth/apiClient';

jest.mock('../../state');
jest.mock('../useVideoContext/useVideoContext');
jest.mock('../../state/useFirebaseAuth/apiClient', () => ({
  ...jest.requireActual('../../state/useFirebaseAuth/apiClient'),
  createApiClient: jest.fn(),
}));

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockCreateApiClient = createApiClient as jest.Mock<any>;

const SID = 'RM00000000000000000000000000000abc';
const stored = { roomSid: SID, startedAtIso: '2026-07-03T09:59:00.000Z', timeline: [] } as any;
const built = { roomSid: SID, endReason: 'left' } as any;

describe('useLiveReportSync', () => {
  let json: jest.Mock;
  let send: jest.Mock;
  let restore: jest.Mock;
  let buildReport: jest.Mock;
  let adoptStartTime: jest.Mock;
  const user = { uid: 'uid-1', getIdToken: jest.fn() };

  const render = (enabled = true) =>
    renderHook(() => useLiveReportSync({ enabled, buildReport, adoptStartTime }), {
      wrapper: ({ children }) => React.createElement(AttentionRestoreContext.Provider, { value: restore }, children),
    });

  // Lets the restore promise chain settle without moving the clock.
  const flush = () => act(async () => undefined);
  const advance = (ms: number) =>
    act(async () => {
      jest.advanceTimersByTime(ms);
    });

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    json = jest.fn(() => Promise.resolve(stored));
    send = jest.fn(() => Promise.resolve());
    restore = jest.fn();
    buildReport = jest.fn(() => built);
    adoptStartTime = jest.fn();
    mockCreateApiClient.mockReturnValue({ json, send });
    mockUseAppState.mockReturnValue({ user });
    mockUseVideoContext.mockReturnValue({ room: { sid: SID, name: 'matematicas-2a' } });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    jest.clearAllMocks();
  });

  it('restores the stored snapshot on entry and adopts its start time', async () => {
    render();
    await flush();

    expect(json).toHaveBeenCalledWith(`/reports/${SID}/live`);
    expect(restore).toHaveBeenCalledWith(stored);
    expect(adoptStartTime).toHaveBeenCalledWith(stored.startedAtIso);
  });

  it('pushes the live snapshot every 30 s through the api client, as endReason left', async () => {
    const { unmount } = render();
    await flush();
    expect(send).not.toHaveBeenCalled();

    await advance(LIVE_PUSH_INTERVAL_MS);
    expect(buildReport).toHaveBeenCalledWith('left');
    expect(send).toHaveBeenCalledWith(`/reports/${SID}/live`, { method: 'PUT', json: built });

    await advance(LIVE_PUSH_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(2);
    unmount();
    await advance(LIVE_PUSH_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('starts pushing when there is nothing to restore (404)', async () => {
    json.mockRejectedValue(new ClientApiError(404, 'live report not found', 'nada'));
    render();
    await flush();

    await advance(LIVE_PUSH_INTERVAL_MS);

    expect(restore).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never pushes before the restore settled, so an empty snapshot cannot overwrite the stored one', async () => {
    json.mockRejectedValueOnce(new Error('offline'));
    render();
    await flush();

    await advance(LIVE_PUSH_INTERVAL_MS);
    expect(send).not.toHaveBeenCalled();

    // The retry succeeds: the snapshot is restored and pushing starts afterwards.
    await advance(LIVE_RESTORE_RETRY_MS);
    expect(json.mock.calls.length).toBeGreaterThan(1);
    expect(restore).toHaveBeenCalledWith(stored);
    await advance(LIVE_PUSH_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stops pushing for good once the server refuses (class ended or not the owner)', async () => {
    send.mockRejectedValue(new ClientApiError(409, 'report already final', 'cerrada'));
    render();
    await flush();

    await advance(LIVE_PUSH_INTERVAL_MS);
    await advance(LIVE_PUSH_INTERVAL_MS * 3);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps pushing after a transient failure and never throws', async () => {
    send.mockRejectedValue(new Error('offline'));
    render();
    await flush();

    await advance(LIVE_PUSH_INTERVAL_MS);
    await advance(LIVE_PUSH_INTERVAL_MS);

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('skips a push when there is nothing to report', async () => {
    buildReport.mockReturnValue(null);
    render();
    await flush();

    await advance(LIVE_PUSH_INTERVAL_MS);

    expect(send).not.toHaveBeenCalled();
  });

  it('is inert for a co-teacher / student (enabled=false): no request at all', async () => {
    render(false);
    await flush();
    await advance(LIVE_PUSH_INTERVAL_MS * 2);

    expect(mockCreateApiClient).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('is inert while the attention pipeline flag is off: no network', async () => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    render();
    await flush();
    await advance(LIVE_PUSH_INTERVAL_MS * 2);

    expect(json).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('is inert without a room sid or a signed-in user', async () => {
    mockUseVideoContext.mockReturnValue({ room: null });
    render();
    await flush();
    await advance(LIVE_PUSH_INTERVAL_MS);

    expect(json).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
