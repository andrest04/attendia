import React from 'react';
import { ClientApiError } from '../../state/useFirebaseAuth/apiClient';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
import { mount } from 'enzyme';
import ReportPage from './ReportPage';
import { MemoryRouter, Route } from 'react-router-dom';
import { useAppState } from '../../state';
import i18n from '../../i18n/testInit';
import { act } from 'react-dom/test-utils';
import completeReportsEn from '../../i18n/locales/completeReports.en';
import completeReportsEs from '../../i18n/locales/completeReports.es';

// AttentionReportView's chart uses echarts, which needs a real canvas/SVG
// renderer jsdom doesn't provide — stub it out.
jest.mock('echarts-for-react', () => ({
  __esModule: true,
  default: () => <div data-testid="attention-report-echarts-stub" />,
}));

jest.mock('../../state');
i18n.on('languageChanged', setCurrentLanguage);

const mockUseAppState = useAppState as jest.Mock<any>;
const roomSid = 'RM00000000000000000000000000000abc';

describe('ReportPage', () => {
  beforeEach(() => {
    mockUseAppState.mockImplementation(() => ({}));
  });

  let mounted: Array<ReturnType<typeof mount>> = [];
  afterEach(() => { mounted.forEach(wrapper => wrapper.length && wrapper.unmount()); mounted = []; });

  const mountPage = () => {
    const wrapper = mount(
      <MemoryRouter initialEntries={[`/report/${roomSid}`]}>
        <Route path="/report/:roomSid">
          <ReportPage />
        </Route>
      </MemoryRouter>
    );
    mounted.push(wrapper);
    return wrapper;
  };

  it('does not render a report when the authenticated API is unavailable', () => {
    const wrapper = mountPage();
    wrapper.update();
    expect(wrapper.find('[data-testid="report-page-empty"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No pudimos validar tu acceso al reporte.');
  });

  it('updates the page and access error when the language changes', async () => {
    i18n.addResourceBundle('en', 'common', completeReportsEn, true, true);
    i18n.addResourceBundle('es', 'common', completeReportsEs, true, true);
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('No pudimos validar tu acceso al reporte.');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.text()).toContain('Attention Report');
    expect(wrapper.text()).toContain('We could not verify your access to the report.');
    wrapper.unmount();
    await act(async () => { await i18n.changeLanguage('es'); });
  });

  it('updates a failed API request on language change without refetching', async () => {
    const fetchAttentionReport = jest.fn(() => Promise.reject(new ClientApiError(503, 'unknown', 'Error del servidor.')));
    mockUseAppState.mockImplementation(() => ({ fetchAttentionReport }));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mountPage();
    try {
      await act(async () => {});
      wrapper.update();
      expect(wrapper.text()).toContain('Error del servidor.');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('The request could not be completed.');
      expect(fetchAttentionReport).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount(); log.mockRestore();
      await act(async () => { await i18n.changeLanguage('es'); });
    }
  });

  it('closes the tab from the Cerrar button', () => {
    const closeSpy = jest.spyOn(window, 'close').mockImplementation(() => undefined);
    const wrapper = mountPage();
    wrapper.find('[data-testid="report-page-close"]').simulate('click');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    closeSpy.mockRestore();
  });
});
