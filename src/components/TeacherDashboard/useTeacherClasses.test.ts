import { act, renderHook } from '@testing-library/react-hooks';
import useTeacherClasses, { UseTeacherClassesParams } from './useTeacherClasses';
import { mockDashboardData } from './mockDashboardData';
import { checkRoomOpen } from '../PreJoinScreens/checkRoomOpen';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';

jest.mock('../PreJoinScreens/checkRoomOpen');

const mockCheckRoomOpen = checkRoomOpen as jest.Mock<any>;

const NOW = new Date('2026-07-08T15:00:00').getTime();
const HOUR = 60 * 60 * 1000;

const upcoming: ClassRecord = {
  id: 'c-upcoming',
  title: 'Álgebra',
  roomName: 'algebra',
  scheduledAtMs: NOW + HOUR,
  studentCount: 20,
  durationMinutes: 60,
  status: 'scheduled',
};
const expired: ClassRecord = {
  ...upcoming,
  id: 'c-expired',
  title: 'Vieja',
  roomName: 'vieja',
  scheduledAtMs: NOW - 5 * HOUR,
};
const expired2: ClassRecord = { ...expired, id: 'c-expired-2', title: 'Vieja 2', roomName: 'vieja-2' };
const started: ClassRecord = { ...upcoming, id: 'c-started', title: 'Abierta', roomName: 'abierta', status: 'started' };

const flush = () => act(async () => {});

function setup(overrides: Partial<UseTeacherClassesParams> = {}, classes: ClassRecord[] = [upcoming, expired]) {
  const params = {
    fetchClasses: jest.fn(() => Promise.resolve(classes)),
    createClass: jest.fn(),
    deleteClass: jest.fn(() => Promise.resolve()),
    startClass: jest.fn(() => Promise.resolve()),
    professorName: 'Ana',
    onStartClass: jest.fn(),
    refreshNotifications: jest.fn(),
    ...overrides,
  } as UseTeacherClassesParams & Record<string, jest.Mock>;
  const hook = renderHook(() => useTeacherClasses(params));
  return { params, ...hook };
}

describe('useTeacherClasses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockCheckRoomOpen.mockResolvedValue(false);
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore();
  });

  describe('without the real classes API (mock mode)', () => {
    const mockModeParams = {
      fetchClasses: undefined,
      createClass: undefined,
      deleteClass: undefined,
      startClass: undefined,
    };

    it('falls back to the mock sessions and date label', () => {
      const { result } = setup(mockModeParams);

      expect(result.current.hasRealClasses).toBe(false);
      expect(result.current.sessions).toBe(mockDashboardData.upcomingSessions);
      expect(result.current.dateLabel).toBe(mockDashboardData.upcomingSessionsDateLabel);
      expect(result.current.expiredSessions).toEqual([]);
      expect(result.current.expiredClasses).toEqual([]);
      expect(result.current.expiredClassIds.size).toBe(0);
    });

    it('offers no class mutations', () => {
      const { result } = setup(mockModeParams);

      expect(result.current.handleCreateClass).toBeUndefined();
      expect(result.current.handleCancelClass).toBeUndefined();
      expect(result.current.handleDeleteClassFromResources).toBeUndefined();
      expect(result.current.handleCancelExpiredClasses).toBeUndefined();
    });

    it('does not load anything', () => {
      const { result } = setup(mockModeParams);

      expect(result.current.isClassesLoading).toBe(false);
      expect(result.current.classesError).toBeNull();
      expect(result.current.realClasses).toEqual([]);
    });

    it('needs all four API functions to count as real', async () => {
      const { result } = setup({ startClass: undefined });
      await flush();

      expect(result.current.hasRealClasses).toBe(false);
    });
  });

  describe('loading', () => {
    it('loads the classes on mount and derives the sessions from them', async () => {
      const { result } = setup();
      expect(result.current.isClassesLoading).toBe(true);

      await flush();

      expect(result.current.isClassesLoading).toBe(false);
      expect(result.current.realClasses).toEqual([upcoming, expired]);
      expect(result.current.hasRealClasses).toBe(true);
      expect(result.current.sessions.map(s => s.id)).toEqual(['c-upcoming']);
      expect(result.current.expiredSessions.map(s => s.id)).toEqual(['c-expired']);
      expect(result.current.expiredClasses).toEqual([expired]);
      expect([...result.current.expiredClassIds]).toEqual(['c-expired']);
      expect(result.current.dateLabel).toMatch(/^[A-ZÁÉÍÓÚ]/);
    });

    it('reports the failure message and logs it', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { result } = setup({ fetchClasses: jest.fn(() => Promise.reject(new Error('Sin conexión.'))) });

      await flush();

      expect(result.current.classesError).toBe('Sin conexión.');
      expect(result.current.isClassesLoading).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('falls back to a generic message when the failure has none', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { result } = setup({ fetchClasses: jest.fn(() => Promise.reject(new Error(''))) });

      await flush();

      expect(result.current.classesError).toBe('No pudimos consultar las clases programadas.');
      errorSpy.mockRestore();
    });

    it('reloads on demand and clears the previous error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const fetchClasses = jest
        .fn()
        .mockRejectedValueOnce(new Error('Falló.'))
        .mockResolvedValueOnce([upcoming]);
      const { result } = setup({ fetchClasses });
      await flush();
      expect(result.current.classesError).toBe('Falló.');

      act(() => result.current.loadClasses());
      expect(result.current.isClassesLoading).toBe(true);
      expect(result.current.classesError).toBeNull();
      await flush();

      expect(result.current.realClasses).toEqual([upcoming]);
      errorSpy.mockRestore();
    });
  });

  describe('creating', () => {
    it('puts the created class first', async () => {
      const created: ClassRecord = { ...upcoming, id: 'c-new', title: 'Nueva' };
      const createClass = jest.fn(() => Promise.resolve(created));
      const { result } = setup({ createClass });
      await flush();

      const input = {
        title: 'Nueva',
        scheduledAtMs: NOW,
        studentCount: 0,
        durationMinutes: 60,
        idempotencyKey: 'k',
        roomName: 'nueva',
      };
      await act(async () => {
        await result.current.handleCreateClass!(input);
      });

      expect(createClass).toHaveBeenCalledWith(input);
      expect(result.current.realClasses.map(c => c.id)).toEqual(['c-new', 'c-upcoming', 'c-expired']);
    });
  });

  describe('cancelling one class', () => {
    it('asks for confirmation before deleting anything', async () => {
      const { result, params } = setup();
      await flush();

      act(() => result.current.handleCancelClass!({ id: 'c-upcoming', title: 'Álgebra' }));

      expect(result.current.isCancelDialogOpen).toBe(true);
      expect(result.current.cancelDialogSession).toEqual({ id: 'c-upcoming', title: 'Álgebra' });
      expect(params.deleteClass).not.toHaveBeenCalled();
    });

    it('closes the dialog but keeps its target, so the exit animation does not flash', async () => {
      const { result } = setup();
      await flush();
      act(() => result.current.handleCancelClass!({ id: 'c-upcoming', title: 'Álgebra' }));

      act(() => result.current.setIsCancelDialogOpen(false));

      expect(result.current.isCancelDialogOpen).toBe(false);
      expect(result.current.cancelDialogSession).toEqual({ id: 'c-upcoming', title: 'Álgebra' });
    });

    it('does nothing when confirmed without a target', async () => {
      const { result, params } = setup();
      await flush();

      act(() => result.current.confirmCancelClass());

      expect(params.deleteClass).not.toHaveBeenCalled();
    });

    it('deletes the class, drops it from the list and refreshes the bell', async () => {
      const { result, params } = setup();
      await flush();
      act(() => result.current.handleCancelClass!({ id: 'c-upcoming', title: 'Álgebra' }));

      act(() => result.current.confirmCancelClass());
      expect(result.current.isCancelDialogOpen).toBe(false);
      expect(result.current.cancellingClassId).toBe('c-upcoming');
      await flush();

      expect(params.deleteClass).toHaveBeenCalledWith('c-upcoming');
      expect(result.current.realClasses.map(c => c.id)).toEqual(['c-expired']);
      expect(result.current.cancellingClassId).toBeNull();
      expect(result.current.cancelError).toBeNull();
      expect(params.refreshNotifications).toHaveBeenCalledTimes(1);
    });

    it('keeps the class and exposes the error when the deletion fails, then retries it', async () => {
      const deleteClass = jest
        .fn()
        .mockRejectedValueOnce(new Error('Sin permiso.'))
        .mockResolvedValueOnce(undefined);
      const { result, params } = setup({ deleteClass });
      await flush();
      act(() => result.current.handleCancelClass!({ id: 'c-upcoming', title: 'Álgebra' }));
      act(() => result.current.confirmCancelClass());
      await flush();

      expect(result.current.cancelError).toBe('Sin permiso.');
      expect(result.current.realClasses.map(c => c.id)).toContain('c-upcoming');
      expect(params.refreshNotifications).not.toHaveBeenCalled();

      act(() => result.current.retryCancelClass());
      expect(result.current.cancelError).toBeNull();
      await flush();

      expect(deleteClass).toHaveBeenCalledTimes(2);
      expect(deleteClass).toHaveBeenLastCalledWith('c-upcoming');
      expect(result.current.realClasses.map(c => c.id)).toEqual(['c-expired']);
    });

    it('uses a generic message when the failure has none', async () => {
      const { result } = setup({ deleteClass: jest.fn(() => Promise.reject(new Error(''))) });
      await flush();
      act(() => result.current.handleCancelClass!({ id: 'c-upcoming', title: 'Álgebra' }));
      act(() => result.current.confirmCancelClass());
      await flush();

      expect(result.current.cancelError).toBe('No pudimos cancelar la clase.');
    });

    it('has nothing to retry before any failure', async () => {
      const { result, params } = setup();
      await flush();

      act(() => result.current.retryCancelClass());

      expect(params.deleteClass).not.toHaveBeenCalled();
    });

    it('forgets the retry target once a retry succeeds', async () => {
      const deleteClass = jest
        .fn()
        .mockRejectedValueOnce(new Error('x'))
        .mockResolvedValue(undefined);
      const { result } = setup({ deleteClass });
      await flush();
      act(() => result.current.handleCancelClass!({ id: 'c-upcoming', title: 'Álgebra' }));
      act(() => result.current.confirmCancelClass());
      await flush();
      act(() => result.current.retryCancelClass());
      await flush();
      expect(deleteClass).toHaveBeenCalledTimes(2);

      act(() => result.current.retryCancelClass());

      expect(deleteClass).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleting from resources', () => {
    it('deletes straight away and drops the class from the list', async () => {
      const { result, params } = setup();
      await flush();

      await act(async () => {
        await result.current.handleDeleteClassFromResources!('c-expired');
      });

      expect(params.deleteClass).toHaveBeenCalledWith('c-expired');
      expect(result.current.realClasses.map(c => c.id)).toEqual(['c-upcoming']);
    });
  });

  describe('cancelling the expired classes', () => {
    it('does not open the dialog when nothing is expired', async () => {
      const { result } = setup({}, [upcoming]);
      await flush();

      act(() => result.current.handleCancelExpiredClasses!());

      expect(result.current.isCancelExpiredDialogOpen).toBe(false);
    });

    it('opens the dialog when something is expired', async () => {
      const { result } = setup();
      await flush();

      act(() => result.current.handleCancelExpiredClasses!());

      expect(result.current.isCancelExpiredDialogOpen).toBe(true);
    });

    it('deletes every expired class and keeps the rest', async () => {
      const { result, params } = setup({}, [upcoming, expired, expired2]);
      await flush();
      act(() => result.current.handleCancelExpiredClasses!());

      act(() => result.current.confirmCancelExpiredClasses());
      expect(result.current.isCancelExpiredDialogOpen).toBe(false);
      expect(result.current.isCancellingExpired).toBe(true);
      await flush();

      expect(params.deleteClass).toHaveBeenCalledWith('c-expired');
      expect(params.deleteClass).toHaveBeenCalledWith('c-expired-2');
      expect(result.current.realClasses.map(c => c.id)).toEqual(['c-upcoming']);
      expect(result.current.isCancellingExpired).toBe(false);
      expect(result.current.cancelExpiredError).toBeNull();
    });

    it('reports how many could not be cancelled (singular)', async () => {
      const deleteClass = jest.fn((id: string) =>
        id === 'c-expired' ? Promise.reject(new Error('x')) : Promise.resolve()
      );
      const { result } = setup({ deleteClass }, [upcoming, expired, expired2]);
      await flush();

      act(() => result.current.confirmCancelExpiredClasses());
      await flush();

      expect(result.current.cancelExpiredError).toBe('No pudimos cancelar 1 clase vencida.');
      expect(result.current.realClasses.map(c => c.id)).toEqual(['c-upcoming', 'c-expired']);
    });

    it('reports how many could not be cancelled (plural)', async () => {
      const { result } = setup({ deleteClass: jest.fn(() => Promise.reject(new Error('x'))) }, [
        upcoming,
        expired,
        expired2,
      ]);
      await flush();

      act(() => result.current.confirmCancelExpiredClasses());
      await flush();

      expect(result.current.cancelExpiredError).toBe('No pudimos cancelar 2 clases vencidas.');
      expect(result.current.realClasses).toHaveLength(3);
    });
  });

  describe('starting a class', () => {
    const teacherName = 'Ana [Profesor]';

    it('starts a scheduled class whose room is free', async () => {
      const { result, params } = setup();
      await flush();

      await act(async () => {
        await result.current.startScheduledClass('c-upcoming', 'algebra');
      });
      await flush();

      expect(mockCheckRoomOpen).toHaveBeenCalledWith('algebra');
      expect(params.startClass).toHaveBeenCalledWith('c-upcoming', 'algebra');
      expect(params.onStartClass).toHaveBeenCalledWith({
        roomName: 'algebra',
        name: teacherName,
        classId: 'c-upcoming',
      });
      expect(result.current.isStartingClass).toBe(false);
      expect(result.current.startClassError).toBeNull();
    });

    it('still starts when the room probe cannot tell', async () => {
      mockCheckRoomOpen.mockResolvedValue(null);
      const { result, params } = setup();
      await flush();

      await act(async () => {
        await result.current.startScheduledClass('c-upcoming', 'algebra');
      });
      await flush();

      expect(params.onStartClass).toHaveBeenCalledTimes(1);
    });

    it("resumes the teacher's own open session instead of failing", async () => {
      mockCheckRoomOpen.mockResolvedValue(true);
      const { result, params } = setup({}, [upcoming, started]);
      await flush();

      await act(async () => {
        await result.current.startScheduledClass('c-upcoming', 'abierta');
      });

      expect(params.startClass).not.toHaveBeenCalled();
      expect(params.onStartClass).toHaveBeenCalledWith({
        roomName: 'abierta',
        name: teacherName,
        classId: 'c-started',
      });
      expect(result.current.isStartingClass).toBe(false);
    });

    it('explains that the room is taken when someone else has it open', async () => {
      mockCheckRoomOpen.mockResolvedValue(true);
      const { result, params } = setup();
      await flush();

      await act(async () => {
        await result.current.startScheduledClass('c-upcoming', 'algebra');
      });

      expect(result.current.startClassError).toBe(
        'Ya hay una sesión activa con este nombre de sala. Espera a que termine o cambia el título de la clase.'
      );
      expect(result.current.isStartingClass).toBe(false);
      expect(params.startClass).not.toHaveBeenCalled();
      expect(params.onStartClass).not.toHaveBeenCalled();
    });

    it('reports a failure to start the class', async () => {
      const startClass = jest.fn(() => Promise.reject(new Error('No hay cupo.')));
      const { result, params } = setup({ startClass });
      await flush();

      await act(async () => {
        await result.current.startScheduledClass('c-upcoming', 'algebra');
      });
      await flush();

      expect(result.current.startClassError).toBe('No hay cupo.');
      expect(result.current.isStartingClass).toBe(false);
      expect(params.onStartClass).not.toHaveBeenCalled();
    });

    it('uses a generic message when starting fails without one', async () => {
      const { result } = setup({ startClass: jest.fn(() => Promise.reject(new Error(''))) });
      await flush();

      await act(async () => {
        await result.current.startScheduledClass('c-upcoming', 'algebra');
      });
      await flush();

      expect(result.current.startClassError).toBe('No pudimos iniciar la clase programada.');
    });

    it('clears the previous start error when trying again', async () => {
      mockCheckRoomOpen.mockResolvedValueOnce(true).mockResolvedValue(false);
      const { result } = setup();
      await flush();
      await act(async () => {
        await result.current.startScheduledClass('c-upcoming', 'algebra');
      });
      expect(result.current.startClassError).not.toBeNull();

      await act(async () => {
        await result.current.startScheduledClass('c-upcoming', 'algebra');
      });
      await flush();

      expect(result.current.startClassError).toBeNull();
    });

    it('routes a session with a class id through the scheduled flow', async () => {
      const { result, params } = setup();
      await flush();

      await act(async () => {
        result.current.handleStartClass({ roomName: 'algebra', name: 'x', classId: 'c-upcoming' });
      });
      await flush();

      expect(params.startClass).toHaveBeenCalledWith('c-upcoming', 'algebra');
    });

    it('starts an ad-hoc session directly', async () => {
      const { result, params } = setup();
      await flush();
      const session = { roomName: 'rapida', name: 'Ana [Profesor]' };

      act(() => result.current.handleStartClass(session));

      expect(params.onStartClass).toHaveBeenCalledWith(session);
      expect(params.startClass).not.toHaveBeenCalled();
    });
  });
});
