import { renderHook } from '@testing-library/react-hooks';
import useShellNotifications from './useShellNotifications';

const createParticipant = (sid: string, identity: string) => ({ sid, identity } as any);

describe('useShellNotifications', () => {
  it('starts with explicit empty state before any events', () => {
    const { result } = renderHook(() => useShellNotifications([]));
    expect(result.current).toEqual([]);
  });

  it('logs classmates joining and leaving', () => {
    const { result, rerender } = renderHook(({ participants }) => useShellNotifications(participants), {
      initialProps: { participants: [createParticipant('PA1', 'Ana')] },
    });

    rerender({ participants: [createParticipant('PA1', 'Ana'), createParticipant('PA2', 'Luis')] });
    expect(result.current.some(n => n.text === 'Luis se unió a la sesión')).toBe(true);

    rerender({ participants: [createParticipant('PA1', 'Ana')] });
    expect(result.current.some(n => n.text === 'Luis salió de la sesión')).toBe(true);
  });

  it('uses the latest cached identity when a classmate leaves', () => {
    const { result, rerender } = renderHook(({ participants }) => useShellNotifications(participants), {
      initialProps: { participants: [createParticipant('PA1', 'Ana'), createParticipant('PA2', 'Luis')] },
    });

    rerender({ participants: [createParticipant('PA1', 'Ana'), createParticipant('PA2', 'Luis R.')] });
    rerender({ participants: [createParticipant('PA1', 'Ana')] });

    expect(result.current.map(n => n.text)).toContain('Luis R. salió de la sesión');
  });

  it('does NOT log the professor joining or leaving (that is a toast, not a panel entry)', () => {
    const { result, rerender } = renderHook(({ participants }) => useShellNotifications(participants), {
      initialProps: { participants: [] as ReturnType<typeof createParticipant>[] },
    });

    rerender({ participants: [createParticipant('PT', 'Profe [Profesor]')] });
    rerender({ participants: [] });

    expect(result.current).toEqual([]);
  });

  it('caps the panel to the last 3 entries so it never fills with noise', () => {
    const { result, rerender } = renderHook(({ participants }) => useShellNotifications(participants), {
      initialProps: { participants: [] as ReturnType<typeof createParticipant>[] },
    });

    rerender({ participants: [createParticipant('P1', 'Uno')] });
    rerender({ participants: [createParticipant('P1', 'Uno'), createParticipant('P2', 'Dos')] });
    rerender({
      participants: [createParticipant('P1', 'Uno'), createParticipant('P2', 'Dos'), createParticipant('P3', 'Tres')],
    });
    rerender({
      participants: [
        createParticipant('P1', 'Uno'),
        createParticipant('P2', 'Dos'),
        createParticipant('P3', 'Tres'),
        createParticipant('P4', 'Cuatro'),
      ],
    });

    expect(result.current).toHaveLength(3);
    expect(result.current.map(n => n.text)).toEqual([
      'Dos se unió a la sesión',
      'Tres se unió a la sesión',
      'Cuatro se unió a la sesión',
    ]);
  });
});
