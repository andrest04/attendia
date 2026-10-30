import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { renderHook } from '@testing-library/react-hooks';
import { mount } from 'enzyme';
import { createI18n } from '../../i18n/createI18n';
import useNotificationToasts from './useNotificationToasts';

const mockEnqueue = jest.fn();
jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueue, closeSnackbar: jest.fn() }),
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

describe('useNotificationToasts in English', () => {
  const english = createI18n({ detect: false, lng: 'en' });
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <I18nextProvider i18n={english}>{children}</I18nextProvider>
  );

  beforeEach(() => mockEnqueue.mockClear());

  it('tells a student about the professor, the recording and the turn', () => {
    const { rerender } = renderHook(props => useNotificationToasts(props), { wrapper, initialProps: base });

    rerender({ ...base, participants: [p('PT', 'Profe [Profesor]')] });
    rerender({ ...base, participants: [p('PT', 'Profe [Profesor]')], isRecording: true });
    rerender({ ...base, participants: [p('PT', 'Profe [Profesor]')], isRecording: true, turnGrantedCount: 1 });

    expect(messages()).toEqual([
      'The professor joined the session',
      'The session is being recorded',
      'It’s your turn · the professor gave you the floor',
    ]);
  });

  it('uses the proctoring kind for the student warning, with a generic fallback', () => {
    const { rerender } = renderHook(props => useNotificationToasts(props), { wrapper, initialProps: base });

    rerender({ ...base, warnedByProfessorCount: 1, lastWarningKind: 'multiface' });
    rerender({ ...base, warnedByProfessorCount: 2, lastWarningKind: null });

    expect(messages()).toEqual([
      'The professor detected several people on your camera',
      'The professor sent you a warning',
    ]);
  });

  it('tells a professor about students joining and raising their hand', () => {
    const { rerender } = renderHook(props => useNotificationToasts(props), {
      wrapper,
      initialProps: { ...base, isTeacher: true },
    });

    rerender({ ...base, isTeacher: true, participants: [p('PA', 'Sofía')] });
    rerender({ ...base, isTeacher: true, participants: [p('PA', 'Sofía')], raisedHands: ['Sofía'] });

    expect(messages()).toEqual(['Sofía joined the session', 'Sofía raised their hand']);
  });
});
