import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider, setI18n } from 'react-i18next';
import { Area, AreaChart } from 'recharts';
import { createI18n } from '../../../i18n/createI18n';
import testI18n from '../../../i18n/testInit';
import AttentionTimelineChart from './AttentionTimelineChart';

jest.mock('recharts', () => {
  const mockReact = require('react');
  const container = ({ children }: { children: React.ReactNode }) => mockReact.createElement('div', null, children);
  const chart = ({ children }: { children: React.ReactNode }) => mockReact.createElement('div', null, children);
  const area = () => null;
  const leaf = () => null;
  return { ResponsiveContainer: container, AreaChart: chart, Area: area, XAxis: leaf, YAxis: leaf, CartesianGrid: leaf, ReferenceLine: leaf, Tooltip: leaf };
});

test('localizes the tooltip series name on a live language switch without changing its numeric data', async () => {
  const i18n = createI18n({ detect: false, lng: 'es' });
  const timeline = [{ time: '10:00', value: 42 }, { time: '10:01', value: 85 }];
  const wrapper = mount(
    <I18nextProvider i18n={i18n}>
      <AttentionTimelineChart timeline={timeline} attentionThreshold={40} />
    </I18nextProvider>
  );
  try {
    expect(wrapper.find(Area).prop('name')).toBe('Atención grupal');
    expect(wrapper.find(Area).prop('dataKey')).toBe('value');
    expect(wrapper.find(AreaChart).prop('data')).toEqual(timeline);
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.find(Area).prop('name')).toBe('Group attention');
    expect(wrapper.find(Area).prop('dataKey')).toBe('value');
    expect(wrapper.find(AreaChart).prop('data')).toEqual(timeline);
  } finally {
    wrapper.unmount();
    setI18n(testI18n);
  }
});
