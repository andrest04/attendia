import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import useRoomState from '../../hooks/useRoomState/useRoomState';
import Snackbar from '../Snackbar/Snackbar';
import ReconnectingNotification from './ReconnectingNotification';

jest.mock('../../hooks/useRoomState/useRoomState');
const mockRoomState = useRoomState as jest.Mock;

test('translates the reconnecting notice while preserving its room-state behavior', async () => {
  const i18n = createI18n({ detect: false, lng: 'es' });
  mockRoomState.mockReturnValue('reconnecting');
  const wrapper = mount(<I18nextProvider i18n={i18n}><ReconnectingNotification /></I18nextProvider>);
  expect(wrapper.text()).toContain('Conexión perdida:');
  expect(wrapper.text()).toContain('Reconectando a la sala...');
  expect(wrapper.find(Snackbar).prop('variant')).toBe('error');
  expect(wrapper.find(Snackbar).prop('open')).toBe(true);
  await act(async () => { await i18n.changeLanguage('en'); });
  wrapper.update();
  expect(wrapper.text()).toContain('Connection Lost:');
  expect(wrapper.text()).toContain('Reconnecting to room...');
  mockRoomState.mockReturnValue('connected');
  wrapper.setProps({ children: <ReconnectingNotification /> });
  expect(wrapper.find(Snackbar).prop('open')).toBe(false);
  wrapper.unmount();
});
