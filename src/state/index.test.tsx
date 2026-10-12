import React from 'react';
import { act, renderHook } from '@testing-library/react-hooks';

import AppStateProvider, { useAppState } from './index';
import useFirebaseAuth from './useFirebaseAuth/useFirebaseAuth';

jest.mock('./useFirebaseAuth/useFirebaseAuth', () => jest.fn(() => ({ user: 'firebaseUser' })));
jest.mock('./useActiveSinkId/useActiveSinkId.ts', () => () => ['default', () => {}]);

const mockUseFirebaseAuth = useFirebaseAuth as jest.Mock<any>;

const wrapper: React.FC = ({ children }) => <AppStateProvider>{children}</AppStateProvider>;

describe('the useAppState hook', () => {
  beforeEach(jest.clearAllMocks);
  beforeEach(() => (process.env = {} as any));
  beforeEach(() => mockUseFirebaseAuth.mockImplementation(() => ({ user: 'firebaseUser' })));

  it('should set an error', () => {
    const { result } = renderHook(useAppState, { wrapper });
    act(() => result.current.setError(new Error('testError')));
    expect(result.current.error!.message).toBe('testError');
  });

  it('should throw an error if used outside of AppStateProvider', () => {
    const { result } = renderHook(useAppState);
    expect(result.error.message).toEqual('useAppState must be used within the AppStateProvider');
  });

  it('should use the useFirebaseAuth hook', async () => {
    const { result } = renderHook(useAppState, { wrapper });
    expect(useFirebaseAuth).toHaveBeenCalled();
    expect(result.current.user).toBe('firebaseUser');
  });

  describe('the getToken function', () => {
    it('should set isFetching to true after getToken is called, and false after getToken succeeds', async () => {
      mockUseFirebaseAuth.mockImplementation(() => ({
        getToken: () =>
          new Promise(resolve => {
            // Using fake timers so we can control when the promise resolves
            setTimeout(() => resolve({ room_type: 'group', token: 'mockVideoToken' }), 10);
          }),
      }));

      jest.useFakeTimers();

      const { result, waitForNextUpdate } = renderHook(useAppState, { wrapper });

      expect(result.current.isFetching).toEqual(false);

      await act(async () => {
        result.current.getToken('test', 'test');
        await waitForNextUpdate();
        expect(result.current.isFetching).toEqual(true);
        jest.runOnlyPendingTimers();
        await waitForNextUpdate();
        expect(result.current.isFetching).toEqual(false);
      });
    });

    it('should set isFetching to true after getToken is called, and false after getToken fails', async () => {
      mockUseFirebaseAuth.mockImplementation(() => ({
        getToken: () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('token error')), 10);
          }),
      }));

      jest.useFakeTimers();

      const { result, waitForNextUpdate } = renderHook(useAppState, { wrapper });

      expect(result.current.isFetching).toEqual(false);

      await act(async () => {
        result.current.getToken('test', 'test').catch(() => {});
        await waitForNextUpdate();
        expect(result.current.isFetching).toEqual(true);
        jest.runOnlyPendingTimers();
        await waitForNextUpdate();
        expect(result.current.isFetching).toEqual(false);
      });
    });
  });

  describe('the updateRecordingRules function', () => {
    it('should resolve with the server result and toggle isFetching around the call', async () => {
      const updateRecordingRules = jest.fn(() => Promise.resolve({ ok: true }));
      mockUseFirebaseAuth.mockImplementation(() => ({ updateRecordingRules }));
      const { result } = renderHook(useAppState, { wrapper });

      let returned: any;
      await act(async () => {
        returned = await result.current.updateRecordingRules('RM1', [{ type: 'include', all: true }]);
      });

      expect(returned).toEqual({ ok: true });
      expect(updateRecordingRules).toHaveBeenCalledWith('RM1', [{ type: 'include', all: true }]);
      expect(result.current.isFetching).toEqual(false);
      expect(result.current.error).toBeNull();
    });

    it('should surface the failure in app state and still reject so callers can react', async () => {
      const failure = new Error('rules rejected');
      mockUseFirebaseAuth.mockImplementation(() => ({ updateRecordingRules: () => Promise.reject(failure) }));
      const { result } = renderHook(useAppState, { wrapper });

      await act(async () => {
        await expect(result.current.updateRecordingRules('RM1', [])).rejects.toBe(failure);
      });

      expect(result.current.error).toBe(failure);
      expect(result.current.isFetching).toEqual(false);
    });
  });

  describe('getToken result handling', () => {
    it('should expose the room type returned by the token server', async () => {
      mockUseFirebaseAuth.mockImplementation(() => ({
        getToken: () => Promise.resolve({ room_type: 'peer-to-peer', token: 't' }),
      }));
      const { result } = renderHook(useAppState, { wrapper });

      await act(async () => {
        await result.current.getToken('test', 'test');
      });

      expect(result.current.roomType).toBe('peer-to-peer');
    });

    it('should set the app error and reject when the token request fails', async () => {
      const failure = new Error('La sala todavía no está abierta.');
      mockUseFirebaseAuth.mockImplementation(() => ({ getToken: () => Promise.reject(failure) }));
      const { result } = renderHook(useAppState, { wrapper });

      await act(async () => {
        await expect(result.current.getToken('test', 'test')).rejects.toBe(failure);
      });

      expect(result.current.error).toBe(failure);
    });
  });
});
