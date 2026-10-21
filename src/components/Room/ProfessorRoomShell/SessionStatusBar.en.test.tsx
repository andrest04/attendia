import React from 'react';
import { mount } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../../i18n/createI18n';
import SessionStatusBar from './SessionStatusBar';

const render = (lng: string, studentCount: number) =>
  mount(
    <I18nextProvider i18n={createI18n({ detect: false, lng })}>
      <SessionStatusBar sessionName="Math" studentCount={studentCount} />
    </I18nextProvider>
  );

describe('SessionStatusBar copy', () => {
  let wrapper: ReturnType<typeof mount> | undefined;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('pluralizes the student count and translates the help button in English', () => {
    wrapper = render('en', 1);
    expect(wrapper.find('[data-testid="professor-room-shell-session-info"]').text()).toContain('1 student ·');
    expect(wrapper.find('[data-testid="professor-room-shell-help-button"]').text()).toBe('Help');
    wrapper.unmount();

    wrapper = render('en', 3);
    expect(wrapper.find('[data-testid="professor-room-shell-session-info"]').text()).toContain('3 students');
  });

  it('keeps Spanish as the base language', () => {
    wrapper = render('es', 0);
    expect(wrapper.find('[data-testid="professor-room-shell-session-info"]').text()).toContain('0 estudiantes');
    expect(wrapper.find('[data-testid="professor-room-shell-help-button"]').text()).toBe('Ayuda');
  });
});
