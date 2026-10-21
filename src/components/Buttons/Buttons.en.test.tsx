import React from 'react';
import { mount } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import RaiseHandButton from './RaiseHandButton/RaiseHandButton';
import UnmuteRequestPrompt from '../Room/UnmuteRequestPrompt/UnmuteRequestPrompt';
import OverflowMenu from '../Room/ToolbarParts/OverflowMenu';

const english = createI18n({ detect: false, lng: 'en' });
const inEnglish = (node: React.ReactElement) => <I18nextProvider i18n={english}>{node}</I18nextProvider>;

describe('toolbar copy in English', () => {
  let wrapper: ReturnType<typeof mount> | undefined;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('RaiseHandButton flips between raise and lower', () => {
    wrapper = mount(inEnglish(<RaiseHandButton />));
    expect(wrapper.find('button').text()).toContain('Raise hand');
    expect(wrapper.find('button').prop('aria-label')).toBe('Raise your hand');

    wrapper.find('button').simulate('click');
    expect(wrapper.find('button').text()).toContain('Lower hand');
    expect(wrapper.find('button').prop('aria-label')).toBe('Lower your hand');
  });

  it('RaiseHandButton keeps the label hidden but accessible in icon-only mode', () => {
    wrapper = mount(inEnglish(<RaiseHandButton iconOnly />));
    expect(wrapper.find('button').text()).toBe('');
    expect(wrapper.find('button').prop('aria-label')).toBe('Raise your hand');
  });

  it('UnmuteRequestPrompt translates the message and both actions', () => {
    wrapper = mount(inEnglish(<UnmuteRequestPrompt open onAccept={jest.fn()} onDismiss={jest.fn()} />));
    const text = wrapper.text();
    expect(text).toContain('The professor asks you to turn on your microphone');
    expect(text).toContain('Not now');
    expect(text).toContain('Turn on');
  });

  it('OverflowMenu labels the kebab', () => {
    wrapper = mount(inEnglish(<OverflowMenu items={[]} testIdPrefix="t" chipClassName="chip" />));
    expect(
      wrapper
        .find('[data-testid="t-more"]')
        .first()
        .prop('aria-label')
    ).toBe('More');
  });
});
