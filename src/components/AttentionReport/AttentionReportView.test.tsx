import React from 'react';
import { mount } from 'enzyme';
import AttentionReportView, { AttentionReportViewData } from './AttentionReportView';

// echarts needs a real canvas/SVG renderer, which jsdom doesn't provide — stub the
// component so we can inspect the `option` it was given instead of letting echarts
// actually try to render. The option is plain, JSON-serializable data (no functions),
// so round-tripping it through an attribute is a simple way to assert on it.
jest.mock('echarts-for-react', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="attention-report-echarts" data-option={JSON.stringify(props.option)} />,
}));

const baseData: AttentionReportViewData = {
  sessionName: 'matematicas-2a',
  studentCount: 2,
  source: 'live',
  attentionThreshold: 60,
  timeline: [
    { time: '10:00:00', value: 40 },
    { time: '10:00:01', value: 80 },
  ],
  hasGroupData: true,
  groupAverage: 60,
  percentAboveThreshold: 50,
  participants: [
    { identity: 'Ana García', indexAvg: 83, indexMin: 70, indexMax: 95, level: 'high', alertCount: 0 },
  ],
  totalAlerts: 0,
  reportDate: new Date('2026-06-20T10:00:00Z'),
};

const readOption = (wrapper: ReturnType<typeof mount>) =>
  JSON.parse(wrapper.find('[data-testid="attention-report-echarts"]').prop('data-option') as string);

describe('AttentionReportView — zoom/scrub timeline (ECharts)', () => {
  it('wires up both an inside (scroll/pinch) and a slider (drag strip) zoom control', () => {
    const option = readOption(mount(<AttentionReportView data={baseData} />));
    const types = option.dataZoom.map((z: any) => z.type);
    expect(types).toEqual(expect.arrayContaining(['inside', 'slider']));
  });

  it('feeds the full timeline into the line series, in order', () => {
    const option = readOption(mount(<AttentionReportView data={baseData} />));
    expect(option.xAxis.data).toEqual(['10:00:00', '10:00:01']);
    expect(option.series[0].data).toEqual([40, 80]);
  });

  it('draws the threshold as a markLine at the configured value', () => {
    const option = readOption(mount(<AttentionReportView data={baseData} />));
    expect(option.series[0].markLine.data).toEqual([{ yAxis: 60 }]);
  });

  it('renders without crashing when the timeline is empty', () => {
    const wrapper = mount(<AttentionReportView data={{ ...baseData, timeline: [] }} />);
    expect(wrapper.find('[data-testid="attention-report-echarts"]').exists()).toBe(true);
  });
});
