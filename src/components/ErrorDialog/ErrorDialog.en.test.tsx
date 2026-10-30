import React from 'react';
import { mount } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import ErrorDialog from './ErrorDialog';

describe('ErrorDialog in English', () => {
  let wrapper: ReturnType<typeof mount> | undefined;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('does not expose an untranslated unknown SDK error', () => {
    const error: any = Object.assign(new Error('mensaje externo'), { code: 99999, name: 'TwilioError' });
    wrapper = mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <ErrorDialog dismissError={() => {}} error={error} />
      </I18nextProvider>
    );
    expect(document.body.textContent).toContain('An unexpected error occurred.');
    expect(document.body.textContent).not.toContain('mensaje externo');
  });

  it('shows the translated message and the English error code label', () => {
    const error: any = Object.assign(new Error('raw'), { code: 20101 });
    wrapper = mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <ErrorDialog dismissError={() => {}} error={error} />
      </I18nextProvider>
    );
    // MUI renders the dialog through a portal, so read the document instead of the wrapper tree.
    expect(document.body.querySelector('code')!.textContent).toBe('Error Code: 20101');
    expect(document.body.textContent).toContain('The session could not be validated.');
  });
});
