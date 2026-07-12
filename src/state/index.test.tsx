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
});
