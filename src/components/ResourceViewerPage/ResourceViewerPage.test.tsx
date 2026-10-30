import React from 'react';
import { ClientApiError } from '../../state/useFirebaseAuth/apiClient';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
import { act } from 'react-dom/test-utils';
import { mount } from 'enzyme';
import { MemoryRouter, Route } from 'react-router-dom';
import ResourceViewerPage from './ResourceViewerPage';
import { useAppState } from '../../state';
import i18n from '../../i18n/testInit';
import en from '../../i18n/locales/completePreview.en';
import es from '../../i18n/locales/completePreview.es';

i18n.addResourceBundle('en', 'common', en, true, true);
i18n.addResourceBundle('es', 'common', es, true, true);

jest.mock('../../state');
i18n.on('languageChanged', setCurrentLanguage);

const mockUseAppState = useAppState as jest.Mock<any>;
const flushPromises = () => act(async () => {});

const pdfFile = {
  id: 'file-a',
  name: 'guia.pdf',
  kind: 'pdf' as const,
  roomLabel: 'Cálculo I',
  sizeBytes: 2_500_000,
  contentType: 'application/pdf',
  createdAtMs: 1751554800000,
};

const videoFile = {
  id: 'file-b',
  name: 'clase.mp4',
  kind: 'video' as const,
  roomLabel: 'Física II',
  sizeBytes: 500,
  contentType: 'video/mp4',
  createdAtMs: null,
};

const wordFile = {
  id: 'file-c',
  name: 'guia.docx',
  kind: 'word' as const,
  roomLabel: 'Cálculo I',
  sizeBytes: 500,
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  createdAtMs: null,
};

describe('ResourceViewerPage', () => {
  beforeEach(() => {
    // @ts-ignore jsdom does not implement this by default
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    // @ts-ignore
    global.URL.revokeObjectURL = jest.fn();
  });

  let mounted: Array<ReturnType<typeof mount>> = [];
  afterEach(() => { mounted.forEach(wrapper => wrapper.length && wrapper.unmount()); mounted = []; });

  const mountPage = (resourceId: string) => {
    const wrapper = mount(
      <MemoryRouter initialEntries={[`/dashboard/recursos/${resourceId}/ver`]}>
        <Route path="/dashboard/recursos/:resourceId/ver">
          <ResourceViewerPage />
        </Route>
      </MemoryRouter>
    );
    mounted.push(wrapper);
    return wrapper;
  };

  it('switches the access error, title and close button without refetching', async () => {
    mockUseAppState.mockImplementation(() => ({}));
    const wrapper = mountPage('file-a');
    expect(wrapper.text()).toContain('Vista previa');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.text()).toContain('Preview');
    expect(wrapper.text()).toContain('Close');
    expect(wrapper.text()).toContain('We could not verify your access to this resource.');
    wrapper.unmount();
    await act(async () => { await i18n.changeLanguage('es'); });
  });

  it('switches the loading message without restarting the request', async () => {
    const fetchResources = jest.fn(() => new Promise(() => {}));
    mockUseAppState.mockImplementation(() => ({ fetchResources, fetchResourceDownloadUrl: jest.fn(), fetchResourcePreviewUrl: jest.fn() }));
    const wrapper = mountPage('file-a');
    expect(wrapper.text()).toContain('Cargando el documento...');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.text()).toContain('Loading the document...');
    expect(fetchResources).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    await act(async () => { await i18n.changeLanguage('es'); });
  });

  it.each([
    ['missing', () => Promise.resolve([]), 'El recurso solicitado no existe.', 'The requested resource does not exist.'],
    ['fallback', () => Promise.reject({}), 'No pudimos cargar el recurso.', 'We could not load the resource.'],
  ])('switches the %s error without retrying', async (_case, load, spanish, english) => {
    const fetchResources = jest.fn(load);
    mockUseAppState.mockImplementation(() => ({ fetchResources, fetchResourceDownloadUrl: jest.fn(), fetchResourcePreviewUrl: jest.fn() }));
    const wrapper = mountPage('file-a');
    await flushPromises();
    wrapper.update();
    expect(wrapper.text()).toContain(spanish);
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.text()).toContain(english);
    expect(fetchResources).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    await act(async () => { await i18n.changeLanguage('es'); });
  });

  it.each(['resource', 'file'])('updates an API %s failure without refetching', async stage => {
    const failure = new ClientApiError(503, 'unknown', 'Error del servidor.');
    const fetchResources = jest.fn(() => stage === 'resource' ? Promise.reject(failure) : Promise.resolve([pdfFile]));
    const fetchResourceDownloadUrl = jest.fn(() => Promise.reject(failure));
    const fetchResourcePreviewUrl = jest.fn();
    mockUseAppState.mockImplementation(() => ({ fetchResources, fetchResourceDownloadUrl, fetchResourcePreviewUrl }));
    const wrapper = mountPage('file-a');
    try {
      await flushPromises(); wrapper.update();
      expect(wrapper.text()).toContain('Error del servidor.');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('The request could not be completed.');
      expect(fetchResources).toHaveBeenCalledTimes(1);
      expect(fetchResourceDownloadUrl).toHaveBeenCalledTimes(stage === 'file' ? 1 : 0);
    } finally {
      wrapper.unmount();
      await act(async () => { await i18n.changeLanguage('es'); });
    }
  });

  it('shows an error state when the authenticated API is unavailable', () => {
    mockUseAppState.mockImplementation(() => ({}));
    const wrapper = mountPage('file-a');
    wrapper.update();

    expect(wrapper.find('[data-testid="resource-viewer-empty"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No pudimos validar tu acceso');
  });

  it('renders a PDF resource in an iframe using the plain download endpoint', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([pdfFile]));
    const fetchResourceDownloadUrl = jest.fn(() => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' })));
    const fetchResourcePreviewUrl = jest.fn();
    mockUseAppState.mockImplementation(() => ({ fetchResources, fetchResourceDownloadUrl, fetchResourcePreviewUrl }));

    const wrapper = mountPage('file-a');
    await flushPromises();
    wrapper.update();

    expect(fetchResourceDownloadUrl).toHaveBeenCalledWith('file-a');
    expect(fetchResourcePreviewUrl).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="resource-viewer-frame"]').prop('src')).toBe('blob:mock-url');
    expect(wrapper.text()).toContain('guia.pdf');
  });

  it('names the video with its unchanged resource name in both languages', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([{ ...videoFile, name: 'Clase & <prueba>.mp4' }]));
    const fetchResourceDownloadUrl = jest.fn(() => Promise.resolve(new Blob(['video'], { type: 'video/mp4' })));
    const fetchResourcePreviewUrl = jest.fn();
    mockUseAppState.mockImplementation(() => ({ fetchResources, fetchResourceDownloadUrl, fetchResourcePreviewUrl }));
    const wrapper = mountPage('file-b');
    try {
      await flushPromises(); wrapper.update();
      expect(wrapper.find('video').prop('aria-label')).toBe('Vista previa de video: Clase & <prueba>.mp4');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      const video = wrapper.find('video');
      expect(video.prop('aria-label')).toBe('Video preview: Clase & <prueba>.mp4');
      expect(video.prop('src')).toBe('blob:mock-url');
      expect(video.prop('controls')).toBe(true);
      expect(video.prop('autoPlay')).toBe(true);
      expect(fetchResources).toHaveBeenCalledTimes(1);
      expect(fetchResourceDownloadUrl).toHaveBeenCalledTimes(1);
      expect(fetchResourcePreviewUrl).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
      await act(async () => { await i18n.changeLanguage('es'); });
    }
  });

  it('renders a video resource in a <video> element', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([videoFile]));
    const fetchResourceDownloadUrl = jest.fn(() => Promise.resolve(new Blob(['video'], { type: 'video/mp4' })));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      fetchResourceDownloadUrl,
      fetchResourcePreviewUrl: jest.fn(),
    }));

    const wrapper = mountPage('file-b');
    await flushPromises();
    wrapper.update();

    expect(wrapper.find('[data-testid="resource-viewer-video"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="resource-viewer-frame"]').exists()).toBe(false);
  });

  it('renders a word/presentation resource via the converted-PDF preview endpoint, not the original download', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([wordFile]));
    const fetchResourceDownloadUrl = jest.fn();
    const fetchResourcePreviewUrl = jest.fn(() => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' })));
    mockUseAppState.mockImplementation(() => ({ fetchResources, fetchResourceDownloadUrl, fetchResourcePreviewUrl }));

    const wrapper = mountPage('file-c');
    await flushPromises();
    wrapper.update();

    expect(fetchResourcePreviewUrl).toHaveBeenCalledWith('file-c');
    expect(fetchResourceDownloadUrl).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="resource-viewer-frame"]').prop('src')).toBe('blob:mock-url');
  });

  it('shows an error state when the resource id does not match any of the teacher\'s resources', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([pdfFile]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      fetchResourceDownloadUrl: jest.fn(),
      fetchResourcePreviewUrl: jest.fn(),
    }));

    const wrapper = mountPage('missing-id');
    await flushPromises();
    wrapper.update();

    expect(wrapper.find('[data-testid="resource-viewer-empty"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('El recurso solicitado no existe.');
  });

  it('shows the server error message when the blob fetch fails', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([pdfFile]));
    const fetchResourceDownloadUrl = jest.fn(() => Promise.reject(new Error('No pudimos preparar la descarga.')));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      fetchResourceDownloadUrl,
      fetchResourcePreviewUrl: jest.fn(),
    }));

    const wrapper = mountPage('file-a');
    await flushPromises();
    wrapper.update();

    expect(wrapper.text()).toContain('No pudimos preparar la descarga.');
  });

  it('closes the tab from the Cerrar button', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([pdfFile]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      fetchResourceDownloadUrl: jest.fn(() => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' }))),
      fetchResourcePreviewUrl: jest.fn(),
    }));
    const closeSpy = jest.spyOn(window, 'close').mockImplementation(() => undefined);

    const wrapper = mountPage('file-a');
    await flushPromises();
    wrapper.update();

    wrapper.find('[data-testid="resource-viewer-page-close"]').simulate('click');

    expect(closeSpy).toHaveBeenCalledTimes(1);
    closeSpy.mockRestore();
  });
});
