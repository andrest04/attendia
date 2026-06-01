import { renderHook } from '@testing-library/react-hooks';
import useShellNotifications from './useShellNotifications';

const createParticipant = (sid: string, identity: string) => ({ sid, identity } as any);

describe('useShellNotifications', () => {
  it('starts with explicit empty state before any events', () => {
    const { result } = renderHook(() => useShellNotifications([], false));
    expect(result.current).toEqual([]);
  });

  it('adds notifications when participants join and when local hand toggles', () => {
    const { result, rerender } = renderHook(
      ({ participants, handRaised }) => useShellNotifications(participants, handRaised),
      {
        initialProps: { participants: [createParticipant('PA1', 'Ana')], handRaised: false },
      }
    );

    rerender({ participants: [createParticipant('PA1', 'Ana'), createParticipant('PA2', 'Luis')], handRaised: false });
    rerender({ participants: [createParticipant('PA1', 'Ana'), createParticipant('PA2', 'Luis')], handRaised: true });

    expect(result.current.some(notification => notification.text.includes('Luis se unió a la sesión'))).toBe(true);
    expect(result.current.some(notification => notification.text === 'Levantaste la mano')).toBe(true);
  });

  it('adds notifications when participants leave using their latest cached identity', () => {
    const { result, rerender } = renderHook(
      ({ participants, handRaised }) => useShellNotifications(participants, handRaised),
      {
        initialProps: {
          participants: [createParticipant('PA1', 'Ana'), createParticipant('PA2', 'Luis')],
          handRaised: false,
        },
      }
    );

    rerender({
      participants: [createParticipant('PA1', 'Ana'), createParticipant('PA2', 'Luis R.')],
      handRaised: false,
    });
    rerender({ participants: [createParticipant('PA1', 'Ana')], handRaised: false });

    expect(result.current.map(notification => notification.text)).toContain('Luis R. salió de la sesión');
  });

  it('adds notifications for lowering a raised local hand', () => {
    const { result, rerender } = renderHook(
      ({ participants, handRaised }) => useShellNotifications(participants, handRaised),
      {
        initialProps: { participants: [], handRaised: true },
      }
    );

    rerender({ participants: [], handRaised: false });

    expect(result.current.map(notification => notification.text)).toContain('Bajaste la mano');
  });
});
