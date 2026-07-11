import React from 'react';
import { shallow } from 'enzyme';
import HistoryTab from './HistoryTab';
import { HistoryRow } from './types';

const rows: HistoryRow[] = [
  {
    id: 'row-high',
    className: 'Matemáticas — Grupo B',
    date: '2 jul 2026',
    duration: '1h 02min',
    studentCount: 26,
    attentionPercent: 91,
    recordingStatus: 'lista',
    hasDownload: true,
  },
  {
    id: 'row-medium',
    className: 'Matemáticas — Grupo A',
    date: '7 jul 2026',
    duration: '1h 05min',
    studentCount: 28,
    attentionPercent: 65,
    recordingStatus: 'lista',
    hasDownload: true,
  },
  {
    id: 'row-low',
    className: 'Cálculo III',
    date: '4 jul 2026',
    duration: '58min',
    studentCount: 24,
    attentionPercent: 35,
    recordingStatus: 'no-disponible',
    hasDownload: false,
  },
];

describe('HistoryTab', () => {
  it('colors the attention bar green/amber/red by the low(40)/medium(70)/high threshold', () => {
    const wrapper = shallow(<HistoryTab rows={rows} />);

    expect(wrapper.find('[data-testid="dashboard-history-attention-bar-row-high"]').prop('data-level')).toBe('high');
    expect(wrapper.find('[data-testid="dashboard-history-attention-bar-row-high"]').prop('style')).toMatchObject({
      backgroundColor: '#10b981',
    });

    expect(wrapper.find('[data-testid="dashboard-history-attention-bar-row-medium"]').prop('data-level')).toBe(
      'medium'
    );
    expect(wrapper.find('[data-testid="dashboard-history-attention-bar-row-medium"]').prop('style')).toMatchObject({
      backgroundColor: '#ffb800',
    });

    expect(wrapper.find('[data-testid="dashboard-history-attention-bar-row-low"]').prop('data-level')).toBe('low');
    expect(wrapper.find('[data-testid="dashboard-history-attention-bar-row-low"]').prop('style')).toMatchObject({
      backgroundColor: '#ef4444',
    });
  });

  it('shows a download icon only for rows with a recording, and a dash otherwise', () => {
    const wrapper = shallow(<HistoryTab rows={rows} />);

    expect(wrapper.find('[data-testid="dashboard-history-row-row-low"]').text()).toContain('—');
    expect(wrapper.find('[data-testid="dashboard-history-download"]').length).toBe(2);
  });
});
