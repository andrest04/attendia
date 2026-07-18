import React from 'react';
import { mount } from 'enzyme';
import ReportPage from './ReportPage';
import { MemoryRouter, Route } from 'react-router-dom';
import { useAppState } from '../../state';

// AttentionReportView's chart uses echarts, which needs a real canvas/SVG
// renderer jsdom doesn't provide — stub it out.
jest.mock('echarts-for-react', () => ({
  __esModule: true,
  default: () => <div data-testid="attention-report-echarts-stub" />,
}));

jest.mock('../../state');

const mockUseAppState = useAppState as jest.Mock<any>;
const roomSid = 'RM00000000000000000000000000000abc';

describe('ReportPage', () => {
  beforeEach(() => {
    mockUseAppState.mockImplementation(() => ({}));
  });

  const mountPage = () =>
    mount(
      <MemoryRouter initialEntries={[`/report/${roomSid}`]}>
        <Route path="/report/:roomSid">
          <ReportPage />
        </Route>
      </MemoryRouter>
    );

  it('does not render a report when the authenticated API is unavailable', () => {
    const wrapper = mountPage();
    wrapper.update();
    expect(wrapper.find('[data-testid="report-page-empty"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No pudimos validar tu acceso al reporte.');
  });

  it('closes the tab from the Cerrar button', () => {
    const closeSpy = jest.spyOn(window, 'close').mockImplementation(() => undefined);
    const wrapper = mountPage();
    wrapper.find('[data-testid="report-page-close"]').simulate('click');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    closeSpy.mockRestore();
  });
});
