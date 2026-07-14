import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount } from 'enzyme';
import { MemoryRouter, Route } from 'react-router-dom';
import ResourceViewerPage from './ResourceViewerPage';
import { useAppState } from '../../state';

jest.mock('../../state');

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

  const mountPage = (resourceId: string) =>
    mount(
      <MemoryRouter initialEntries={[`/dashboard/recursos/${resourceId}/ver`]}>
        <Route path="/dashboard/recursos/:resourceId/ver">
          <ResourceViewerPage />
        </Route>
      </MemoryRouter>
    );

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
