import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { act, renderHook } from '@testing-library/react-hooks';
import { createI18n } from '../../../i18n/createI18n';
import useShellNotifications from './useShellNotifications';

const participant = (sid: string, identity: string) => ({ sid, identity } as any);

describe('useShellNotifications in English', () => {
  const english = createI18n({ detect: false, lng: 'en' });
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <I18nextProvider i18n={english}>{children}</I18nextProvider>
  );

  it('retranslates existing join and leave events when the language changes in either direction', async () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    const languageWrapper = ({ children }: { children?: React.ReactNode }) => (
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    );
    const { result, rerender } = renderHook(({ participants }) => useShellNotifications(participants), {
      wrapper: languageWrapper,
      initialProps: { participants: [] as ReturnType<typeof participant>[] },
    });
    rerender({ participants: [participant('PA2', 'Luis')] });
    rerender({ participants: [] });
    expect(result.current.map(n => n.text)).toEqual(['Luis se unió a la sesión', 'Luis salió de la sesión']);
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(result.current.map(n => n.text)).toEqual(['Luis joined the session', 'Luis left the session']);
    await act(async () => { await i18n.changeLanguage('es'); });
    expect(result.current.map(n => n.text)).toEqual(['Luis se unió a la sesión', 'Luis salió de la sesión']);
  });

  it('logs classmates with translated text and a language-independent event', () => {
    const { result, rerender } = renderHook(({ participants }) => useShellNotifications(participants), {
      wrapper,
      initialProps: { participants: [participant('PA1', 'Ana')] },
    });

    rerender({ participants: [participant('PA1', 'Ana'), participant('PA2', 'Luis')] });
    rerender({ participants: [participant('PA1', 'Ana')] });

    expect(result.current.map(n => [n.text, n.event])).toEqual([
      ['Luis joined the session', 'joined'],
      ['Luis left the session', 'left'],
    ]);
  });
});
