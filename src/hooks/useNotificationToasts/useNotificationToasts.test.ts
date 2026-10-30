import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { act } from 'react-dom/test-utils';
import { mount } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import useNotificationToasts from './useNotificationToasts';

const mockEnqueue = jest.fn();
let useRealSnackbar = false;
jest.mock('notistack', () => ({
  useSnackbar: () => useRealSnackbar ? jest.requireActual('notistack').useSnackbar() : ({ enqueueSnackbar: mockEnqueue, closeSnackbar: jest.fn() }),
}));

const p = (sid: string, identity: string) => ({ sid, identity } as any);

const base = {
  isTeacher: false,
  participants: [] as ReturnType<typeof p>[],
  raisedHands: [] as string[],
  isRecording: false,
  turnGrantedCount: 0,
  mutedByProfessorCount: 0,
  warnedByProfessorCount: 0,
  lastWarningKind: null as null | 'multiface' | 'absent' | 'away' | 'camera-off',
};

const messages = () => mockEnqueue.mock.calls.map(call => {
  const view = mount(call[0]);
  const text = view.text();
  view.unmount();
  return text;
});

describe('visible notification localization', () => {
  it('updates an existing interpolated toast without enqueueing another event', async () => {
    const instance = createI18n({ detect: false, lng: 'es' });
    const SnackbarProvider = jest.requireActual('notistack').SnackbarProvider;
    useRealSnackbar = true;
    const Hook = ({ participants }: { participants: ReturnType<typeof p>[] }) => {
      useNotificationToasts({ ...base, isTeacher: true, participants });
      return null;
    };
    const App = ({ participants }: { participants: ReturnType<typeof p>[] }) => React.createElement(I18nextProvider, { i18n: instance },
      React.createElement(SnackbarProvider, { autoHideDuration: 60000 }, React.createElement(Hook, { participants })));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = mount(React.createElement(App, { participants: [] as ReturnType<typeof p>[] }), { attachTo: container });
    try {
      act(() => { view.setProps({ participants: [p('1', 'Sofía')] }); });
      view.update();
      expect(document.body.textContent).toContain('Sofía se unió a la sesión');
      await act(async () => { await instance.changeLanguage('en'); });
      view.update();
      expect(document.body.textContent).toContain('Sofía joined the session');
      expect(document.body.textContent).not.toContain('Sofía se unió a la sesión');
      expect(document.body.textContent!.split('Sofía joined the session')).toHaveLength(2);
    } finally {
      view.unmount();
      await instance.changeLanguage('es');
      document.body.removeChild(container);
      useRealSnackbar = false;
    }
  });
});

describe('useNotificationToasts', () => {
  beforeEach(() => mockEnqueue.mockClear());

  it('does not fire any toast for the state already present on mount', () => {
    renderHook(() =>
      useNotificationToasts({ ...base, isTeacher: true, participants: [p('PA1', 'Ana')], raisedHands: ['Ana'] })
    );
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  describe('student', () => {
    it('toasts when the professor joins and leaves, not when classmates do', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: false, participants: [] as ReturnType<typeof p>[] },
      });

      rerender({ ...base, isTeacher: false, participants: [p('PC', 'Carla')] }); // classmate → no toast
      rerender({ ...base, isTeacher: false, participants: [p('PC', 'Carla'), p('PT', 'Profe [Profesor]')] });
      rerender({ ...base, isTeacher: false, participants: [p('PC', 'Carla')] }); // professor left

      expect(messages()).toEqual(['El profesor se unió a la sesión', 'El profesor salió de la sesión']);
    });

    it('toasts recording on/off and the granted turn', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: false },
      });

      rerender({ ...base, isTeacher: false, isRecording: true });
      rerender({ ...base, isTeacher: false, isRecording: false });
      rerender({ ...base, isTeacher: false, turnGrantedCount: 1 });

      expect(messages()).toEqual([
        'La sesión se está grabando',
        'Se detuvo la grabación',
        'Es tu turno · el profesor te dio la palabra',
      ]);
    });

    it('does NOT toast a raised hand for a student', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: false, raisedHands: [] as string[] },
      });
      rerender({ ...base, isTeacher: false, raisedHands: ['Otro'] });
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('toasts when the professor mutes this student', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: false, mutedByProfessorCount: 0 },
      });
      rerender({ ...base, isTeacher: false, mutedByProfessorCount: 1 });
      expect(messages()).toEqual(['El profesor silenció tu micrófono']);
    });

    it('toasts when the professor turns this student camera off', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: false, cameraOffByProfessorCount: 0 },
      });
      rerender({ ...base, isTeacher: false, cameraOffByProfessorCount: 1 });
      expect(messages()).toEqual(['El profesor apagó tu cámara']);
    });

    it('toasts a kind-specific message when the professor sends this student a warning', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: false },
      });
      rerender({ ...base, isTeacher: false, warnedByProfessorCount: 1, lastWarningKind: 'camera-off' });
      expect(messages()).toEqual(['El profesor te pidió encender tu cámara']);
    });
  });

  describe('professor', () => {
    it('toasts students joining, leaving and raising their hand (suffix stripped)', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: true, participants: [] as ReturnType<typeof p>[] },
      });

      rerender({ ...base, isTeacher: true, participants: [p('PS', 'Sofía')] }); // student joined
      rerender({ ...base, isTeacher: true, participants: [p('PS', 'Sofía')], raisedHands: ['Sofía'] }); // hand
      rerender({ ...base, isTeacher: true, participants: [] as ReturnType<typeof p>[], raisedHands: [] as string[] }); // left

      expect(messages()).toEqual(['Sofía se unió a la sesión', 'Sofía levantó la mano', 'Sofía salió de la sesión']);
    });

    it('does NOT toast recording or turn changes for the professor', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: true },
      });
      rerender({ ...base, isTeacher: true, isRecording: true });
      rerender({ ...base, isTeacher: true, turnGrantedCount: 5 });
      rerender({ ...base, isTeacher: true, warnedByProfessorCount: 2, lastWarningKind: 'multiface' });
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('toasts a co-teacher when the owner mutes the mic or turns the camera off', () => {
      const { rerender } = renderHook(props => useNotificationToasts(props), {
        initialProps: { ...base, isTeacher: true, mutedByProfessorCount: 0, cameraOffByProfessorCount: 0 },
      });
      rerender({ ...base, isTeacher: true, mutedByProfessorCount: 1, cameraOffByProfessorCount: 0 });
      rerender({ ...base, isTeacher: true, mutedByProfessorCount: 1, cameraOffByProfessorCount: 1 });
      expect(messages()).toEqual(['El profesor silenció tu micrófono', 'El profesor apagó tu cámara']);
    });
  });
});
