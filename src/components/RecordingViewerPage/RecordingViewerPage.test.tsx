import React from 'react';
import { ClientApiError } from '../../state/useFirebaseAuth/apiClient';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
import { act } from 'react-dom/test-utils';
import { mount } from 'enzyme';
import { MemoryRouter, Route } from 'react-router-dom';
import RecordingViewerPage from './RecordingViewerPage';
import { useAppState } from '../../state';
import i18n from '../../i18n/testInit';
import es from '../../i18n/locales/completeReports.es';
import en from '../../i18n/locales/completeReports.en';

jest.mock('../../state');
i18n.on('languageChanged', setCurrentLanguage);

const mockUseAppState = useAppState as jest.Mock<any>;
const flushPromises = () => act(async () => {});
const roomSid = 'RM00000000000000000000000000000abc';

describe('RecordingViewerPage', () => {
  // The state mock is shared, so a page left mounted by an earlier test would re-render
  // against a later test's mock. Unmount everything between tests.
  let mounted: Array<ReturnType<typeof mount>> = [];
  afterEach(() => {
    mounted.forEach(wrapper => wrapper.length && wrapper.unmount());
    mounted = [];
  });

  const mountPage = () => {
    const wrapper = mount(
      <MemoryRouter initialEntries={[`/recording/${roomSid}`]}>
        <Route path="/recording/:roomSid">
          <RecordingViewerPage />
        </Route>
      </MemoryRouter>
    );
    mounted.push(wrapper);
    return wrapper;
  };

  it('updates the generic loading failure in both languages without refetching', async () => {
    i18n.addResourceBundle('es', 'common', es, true, true);
    i18n.addResourceBundle('en', 'common', en, true, true);
    const fetchRecordingDownloadUrl = jest.fn(() => Promise.reject(new Error('')));
    mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
    const wrapper = mountPage();
    try {
      await flushPromises();
      wrapper.update();
      expect(wrapper.text()).toContain('No pudimos cargar la grabación.');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('Class recording');
      expect(wrapper.text()).toContain('We could not load the recording.');
      expect(fetchRecordingDownloadUrl).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount();
      mounted = [];
      await act(async () => { await i18n.changeLanguage('es'); });
    }
  });

  it('shows an error state when the authenticated API is unavailable', () => {
    mockUseAppState.mockImplementation(() => ({}));
    const wrapper = mountPage();
    wrapper.update();

    expect(wrapper.find('[data-testid="recording-viewer-empty"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No pudimos validar tu acceso a esta grabación.');
    expect(wrapper.find('[data-testid="recording-viewer-video"]').exists()).toBe(false);
  });

  it('shows a loading message until the ticket URL arrives', async () => {
    mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl: jest.fn(() => new Promise(() => {})) }));
    const wrapper = mountPage();
    await flushPromises();
    wrapper.update();

    expect(
      wrapper
        .find('[data-testid="recording-viewer-empty"]')
        .hostNodes()
        .text()
    ).toContain('Cargando la grabación...');
    expect(wrapper.find('[data-testid="recording-viewer-page-download"]').exists()).toBe(false);
  });

  it('names the video in both languages without refetching or changing playback', async () => {
    i18n.addResourceBundle('es', 'common', es, true, true);
    i18n.addResourceBundle('en', 'common', en, true, true);
    const fetchRecordingDownloadUrl = jest.fn(() => Promise.resolve('https://media.test/ticket-1'));
    mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
    const wrapper = mountPage();
    try {
      await flushPromises(); wrapper.update();
      expect(wrapper.find('video').prop('aria-label')).toBe('Grabación de la clase');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      const video = wrapper.find('video');
      expect(video.prop('aria-label')).toBe('Class recording');
      expect(video.prop('src')).toBe('https://media.test/ticket-1');
      expect(video.prop('controls')).toBe(true);
      expect(video.prop('autoPlay')).toBe(true);
      expect(fetchRecordingDownloadUrl).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount(); mounted = [];
      await act(async () => { await i18n.changeLanguage('es'); });
    }
  });

  it('plays the ticketed URL straight from the video element', async () => {
    const fetchRecordingDownloadUrl = jest.fn(() => Promise.resolve('https://media.test/ticket-1'));
    mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
    const wrapper = mountPage();
    await flushPromises();
    wrapper.update();

    expect(fetchRecordingDownloadUrl).toHaveBeenCalledWith(roomSid);
    const video = wrapper.find('[data-testid="recording-viewer-video"]');
    expect(video.prop('src')).toBe('https://media.test/ticket-1');
    expect(wrapper.find('[data-testid="recording-viewer-empty"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="recording-viewer-page-download"]').exists()).toBe(true);
  });

  it('shows the server message when the recording cannot be loaded', async () => {
    const fetchRecordingDownloadUrl = jest.fn(() => Promise.reject(new Error('La grabación aún se está procesando.')));
    mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
    const wrapper = mountPage();
    await flushPromises();
    wrapper.update();

    expect(
      wrapper
        .find('[data-testid="recording-viewer-empty"]')
        .hostNodes()
        .text()
    ).toContain('La grabación aún se está procesando.');
    expect(wrapper.find('[data-testid="recording-viewer-video"]').exists()).toBe(false);
  });

  it('falls back to a generic message when the failure carries none', async () => {
    const fetchRecordingDownloadUrl = jest.fn(() => Promise.reject(new Error('')));
    mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
    const wrapper = mountPage();
    await flushPromises();
    wrapper.update();

    expect(
      wrapper
        .find('[data-testid="recording-viewer-empty"]')
        .hostNodes()
        .text()
    ).toContain('No pudimos cargar la grabación.');
  });

  it.each(['load', 'download'])('updates an API %s error without refetching', async stage => {
    const failure = new ClientApiError(503, 'unknown', 'Error del servidor.');
    const fetchRecordingDownloadUrl = jest.fn();
    if (stage === 'load') fetchRecordingDownloadUrl.mockRejectedValueOnce(failure);
    else fetchRecordingDownloadUrl.mockResolvedValueOnce('https://media.test/ticket').mockRejectedValueOnce(failure);
    mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
    const wrapper = mountPage();
    try {
      await flushPromises(); wrapper.update();
      if (stage === 'download') {
        wrapper.find('[data-testid="recording-viewer-page-download"]').simulate('click');
        await flushPromises(); wrapper.update();
      }
      expect(wrapper.text()).toContain('Error del servidor.');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('The request could not be completed.');
      expect(fetchRecordingDownloadUrl).toHaveBeenCalledTimes(stage === 'load' ? 1 : 2);
    } finally {
      wrapper.unmount(); mounted = [];
      await act(async () => { await i18n.changeLanguage('es'); });
    }
  });

  describe('download', () => {
    it('asks for a fresh ticket and opens it in a new tab', async () => {
      const fetchRecordingDownloadUrl = jest
        .fn()
        .mockResolvedValueOnce('https://media.test/ticket-1')
        .mockResolvedValueOnce('https://media.test/ticket-2');
      mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const wrapper = mountPage();
      await flushPromises();
      wrapper.update();

      wrapper.find('[data-testid="recording-viewer-page-download"]').simulate('click');
      await flushPromises();

      expect(fetchRecordingDownloadUrl).toHaveBeenCalledTimes(2);
      expect(openSpy).toHaveBeenCalledWith('https://media.test/ticket-2?presentation=html&lang=es', '_blank', 'noopener,noreferrer');
      openSpy.mockRestore();
    });

    it('preserves ticket query parameters and uses the current language for the next download', async () => {
      const fetchRecordingDownloadUrl = jest.fn()
        .mockResolvedValueOnce('/playback?ticket=playback')
        .mockResolvedValueOnce('/download?ticket=first%2Bvalue&extra=keep')
        .mockResolvedValueOnce('/download?ticket=second%2Bvalue&extra=keep');
      mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const wrapper = mountPage();
      try {
        await flushPromises(); wrapper.update();
        wrapper.find('[data-testid="recording-viewer-page-download"]').simulate('click');
        await flushPromises(); wrapper.update();
        await act(async () => { await i18n.changeLanguage('en'); });
        wrapper.update();
        wrapper.find('[data-testid="recording-viewer-page-download"]').simulate('click');
        await flushPromises(); wrapper.update();
        expect(openSpy).toHaveBeenCalledTimes(2);
        const first = new URL(openSpy.mock.calls[0][0] as string);
        const second = new URL(openSpy.mock.calls[1][0] as string);
        expect(first.searchParams.get('ticket')).toBe('first+value');
        expect(second.searchParams.get('ticket')).toBe('second+value');
        for (const url of [first, second]) {
          expect(url.searchParams.get('extra')).toBe('keep');
          expect(url.searchParams.get('presentation')).toBe('html');
        }
        expect(first.searchParams.get('lang')).toBe('es');
        expect(second.searchParams.get('lang')).toBe('en');
        expect(wrapper.find('video').prop('src')).toBe('/playback?ticket=playback');
        expect(fetchRecordingDownloadUrl).toHaveBeenCalledTimes(3);
      } finally {
        openSpy.mockRestore();
        wrapper.unmount(); mounted = [];
        await act(async () => { await i18n.changeLanguage('es'); });
      }
    });

    it('disables the button while the new ticket is being requested', async () => {
      let resolveSecond: (url: string) => void = () => {};
      const fetchRecordingDownloadUrl = jest
        .fn()
        .mockResolvedValueOnce('https://media.test/ticket-1')
        .mockImplementationOnce(() => new Promise<string>(resolve => (resolveSecond = resolve)));
      mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const wrapper = mountPage();
      await flushPromises();
      wrapper.update();

      wrapper.find('[data-testid="recording-viewer-page-download"]').simulate('click');
      wrapper.update();
      expect(wrapper.find('[data-testid="recording-viewer-page-download"]').prop('disabled')).toBe(true);

      resolveSecond('https://media.test/ticket-2');
      await flushPromises();
      wrapper.update();
      expect(wrapper.find('[data-testid="recording-viewer-page-download"]').prop('disabled')).toBe(false);
      openSpy.mockRestore();
    });

    it('reports a failed download without hiding the video', async () => {
      const fetchRecordingDownloadUrl = jest
        .fn()
        .mockResolvedValueOnce('https://media.test/ticket-1')
        .mockRejectedValueOnce(new Error('Ticket vencido.'));
      mockUseAppState.mockImplementation(() => ({ fetchRecordingDownloadUrl }));
      const wrapper = mountPage();
      await flushPromises();
      wrapper.update();

      wrapper.find('[data-testid="recording-viewer-page-download"]').simulate('click');
      await flushPromises();
      wrapper.update();

      expect(
        wrapper
          .find('[data-testid="recording-viewer-page-download-error"]')
          .hostNodes()
          .text()
      ).toContain('Ticket vencido.');
      expect(wrapper.find('[data-testid="recording-viewer-video"]').exists()).toBe(true);
    });
  });

  it('closes the tab from the Cerrar button', async () => {
    mockUseAppState.mockImplementation(() => ({}));
    const closeSpy = jest.spyOn(window, 'close').mockImplementation(() => undefined);
    const wrapper = mountPage();
    wrapper.find('[data-testid="recording-viewer-page-close"]').simulate('click');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    closeSpy.mockRestore();
  });

  it('does not update after it is unmounted while the ticket is still loading', async () => {
    let resolveTicket: (url: string) => void = () => {};
    mockUseAppState.mockImplementation(() => ({
      fetchRecordingDownloadUrl: jest.fn(() => new Promise<string>(resolve => (resolveTicket = resolve))),
    }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const wrapper = mountPage();
    wrapper.unmount();
    mounted = [];

    await act(async () => resolveTicket('https://media.test/late'));

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
