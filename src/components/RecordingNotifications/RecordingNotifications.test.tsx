import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import useIsRecording from '../../hooks/useIsRecording/useIsRecording';
import Snackbar from '../Snackbar/Snackbar';
import RecordingNotifications from './RecordingNotifications';

jest.mock('../../hooks/useIsRecording/useIsRecording');
const mockUseIsRecording = useIsRecording as jest.Mock<boolean | null>;

describe('recording notice localization', () => {
  it('updates mounted notices in both languages and preserves recording transitions and closing', async () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    mockUseIsRecording.mockReturnValue(true);
    const wrapper = mount(<I18nextProvider i18n={i18n}><RecordingNotifications /></I18nextProvider>);
    const active = () => wrapper.find(Snackbar).filterWhere(node => node.prop('open')).first();
    const rerender = () => {
      act(() => { wrapper.setProps({ children: <RecordingNotifications /> }); });
      wrapper.update();
    };
    expect(active().prop('headline')).toBe('Grabación en curso.');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(active().prop('headline')).toBe('Recording is in progress.');

    mockUseIsRecording.mockReturnValue(false);
    rerender();
    expect(active().prop('headline')).toBe('Recording Complete');
    expect(wrapper.text()).toContain('You can view the recording in the');
    expect(wrapper.text()).toContain('Recordings will be available once this room has ended.');
    const link = active().find('a');
    expect(link.text()).toBe('Twilio Console');
    expect(link.prop('href')).toBe('https://www.twilio.com/console/video/logs/recordings');
    expect(link.prop('target')).toBe('_blank');
    expect(link.prop('rel')).toBe('noopener');

    await act(async () => { await i18n.changeLanguage('es'); });
    wrapper.update();
    expect(active().prop('headline')).toBe('Grabación completada');
    expect(wrapper.text()).toContain('Puedes ver la grabación en la');
    expect(wrapper.text()).toContain('Las grabaciones estarán disponibles cuando termine esta sala.');
    expect(active().find('a').text()).toBe('Consola de Twilio');
    expect(active().find('a').prop('href')).toBe('https://www.twilio.com/console/video/logs/recordings');
    act(() => { active().prop('handleClose')!(); });
    wrapper.update();
    expect(wrapper.find(Snackbar).filterWhere(node => node.prop('open'))).toHaveLength(0);

    mockUseIsRecording.mockReturnValue(true);
    rerender();
    expect(active().prop('headline')).toBe('La grabación ha comenzado.');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(active().prop('headline')).toBe('Recording has started.');
    wrapper.unmount();
  });
});
