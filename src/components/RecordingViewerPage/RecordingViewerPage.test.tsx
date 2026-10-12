import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount } from 'enzyme';
import { MemoryRouter, Route } from 'react-router-dom';
import RecordingViewerPage from './RecordingViewerPage';
import { useAppState } from '../../state';

jest.mock('../../state');

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
    mockUseAppState.mockImplementation(() => ({
      fetchRecordingDownloadUrl: jest.fn(() => Promise.reject(new Error('La grabación aún se está procesando.'))),
    }));
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
    mockUseAppState.mockImplementation(() => ({
      fetchRecordingDownloadUrl: jest.fn(() => Promise.reject(new Error(''))),
    }));
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
      expect(openSpy).toHaveBeenCalledWith('https://media.test/ticket-2', '_blank', 'noopener');
      openSpy.mockRestore();
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
