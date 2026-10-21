import React from 'react';
import { mount } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import RaisedHandBadge from './RaisedHandBadge';
import ReconnectingOverlay from './ReconnectingOverlay';

describe('participant tile parts in English', () => {
  let wrapper: ReturnType<typeof mount> | undefined;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('labels the raised hand badge', () => {
    wrapper = mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <RaisedHandBadge size="tile" />
      </I18nextProvider>
    );
    const badge = wrapper.find('[data-testid="participant-raised-hand"]');
    expect(badge.prop('aria-label')).toBe('Hand raised');
    expect(badge.prop('title')).toBe('Hand raised');
  });

  it('says the participant is reconnecting', () => {
    wrapper = mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <ReconnectingOverlay />
      </I18nextProvider>
    );
    expect(wrapper.text()).toBe('Reconnecting...');
  });
});
