import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { renderHook } from '@testing-library/react-hooks';
import { createI18n } from '../../../i18n/createI18n';
import useShellNotifications from './useShellNotifications';

const participant = (sid: string, identity: string) => ({ sid, identity } as any);

describe('useShellNotifications in English', () => {
  const english = createI18n({ detect: false, lng: 'en' });
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <I18nextProvider i18n={english}>{children}</I18nextProvider>
  );

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
