import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount } from 'enzyme';
import ResourcesTab from './ResourcesTab';
import { useAppState } from '../../state';

jest.mock('../../state');

const mockUseAppState = useAppState as jest.Mock<any>;

const flushPromises = () => act(async () => {});

const fileA = {
  id: 'file-a',
  name: 'guia.pdf',
  kind: 'pdf' as const,
  roomLabel: 'Cálculo I',
  classId: 'class-a',
  classTitle: 'Cálculo I',
  roomName: 'calculo-i',
  sizeBytes: 2_500_000,
  contentType: 'application/pdf',
  createdAtMs: 1751554800000,
};

const fileB = {
  id: 'file-b',
  name: 'clase.mp4',
  kind: 'video' as const,
  roomLabel: 'Física II',
  classId: 'class-b',
  classTitle: 'Física II',
  roomName: 'fisica-ii',
  sizeBytes: 500,
  contentType: 'video/mp4',
  createdAtMs: null,
};

describe('the ResourcesTab component', () => {
  const scheduledClasses = [
    {
      id: 'class-a',
      title: 'Cálculo I',
      roomName: 'calculo-i',
      scheduledAtMs: 1,
      studentCount: 10,
      durationMinutes: 60,
      status: 'scheduled' as const,
    },
    {
      id: 'class-b',
      title: 'Física II',
      roomName: 'fisica-ii',
      scheduledAtMs: 2,
      studentCount: 12,
      durationMinutes: 60,
      status: 'scheduled' as const,
    },
  ];
  afterEach(() => jest.clearAllMocks());

  it('shows a fallback message when the real resources API is not available (non-firebase auth modes)', () => {
    mockUseAppState.mockImplementation(() => ({}));
    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);

    expect(wrapper.text()).toContain('Los recursos reales solo están disponibles');
  });

  it('fetches and groups resources by verified classId on mount, defaulting to the first group', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA, fileB]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    expect(fetchResources).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="dashboard-resources-pill-class-a"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resources-pill-class-b"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-a"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-b"]').exists()).toBe(false);
  });

  it('switches the active group when a pill is clicked', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA, fileB]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resources-pill-class-b"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-resource-file-file-b"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-a"]').exists()).toBe(false);
  });

  it('uploads the selected file under a verified class id and prepends it to the active group', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([]));
    const uploadResource = jest.fn(() => Promise.resolve(fileA));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource,
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resources-pill-class-a"]')
      .first()
      .simulate('click');
    wrapper.update();

    const file = new File(['contenido'], 'guia.pdf', { type: 'application/pdf' });
    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-resources-file-input"]')
        .first()
        .simulate('change', {
          target: { files: [file] },
        });
    });
    wrapper.update();

    expect(uploadResource).toHaveBeenCalledWith(file, 'class-a', expect.any(Function));
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-a"]').exists()).toBe(true);
  });

  it('rejects an unsupported file type client-side without calling uploadResource, and lets it be dismissed', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([]));
    const uploadResource = jest.fn(() => Promise.resolve(fileA));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource,
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resources-pill-class-a"]')
      .first()
      .simulate('click');
    wrapper.update();

    const file = new File(['contenido'], 'instalador.exe', { type: 'application/x-msdownload' });
    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-resources-file-input"]')
        .first()
        .simulate('change', { target: { files: [file] } });
    });
    wrapper.update();

    expect(uploadResource).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Tipo de archivo no admitido');
    // The upload button stays enabled — a rejected file is not an active upload.
    expect(
      wrapper
        .find('[data-testid="dashboard-upload-file-button"]')
        .first()
        .prop('disabled')
    ).toBe(false);

    const dismissButton = wrapper.find('[data-testid^="dashboard-resources-uploading-dismiss-"]').first();
    dismissButton.simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid^="dashboard-resources-uploading-card-"]').exists()).toBe(false);
  });

  it('rejects an oversized file client-side without calling uploadResource', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([]));
    const uploadResource = jest.fn(() => Promise.resolve(fileA));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource,
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resources-pill-class-a"]')
      .first()
      .simulate('click');
    wrapper.update();

    const oversizedFile = new File(['contenido'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 26 * 1024 * 1024 });
    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-resources-file-input"]')
        .first()
        .simulate('change', { target: { files: [oversizedFile] } });
    });
    wrapper.update();

    expect(uploadResource).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('supera el tamaño máximo permitido');
  });

  it('rejects the whole selection when it exceeds the max files-per-upload cap', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([]));
    const uploadResource = jest.fn(() => Promise.resolve(fileA));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource,
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resources-pill-class-a"]')
      .first()
      .simulate('click');
    wrapper.update();

    const files = Array.from({ length: 11 }, (_, i) => new File(['contenido'], `guia${i}.pdf`, { type: 'application/pdf' }));
    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-resources-file-input"]')
        .first()
        .simulate('change', { target: { files } });
    });
    wrapper.update();

    expect(uploadResource).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Puedes subir hasta 10 archivos a la vez');
  });

  it('blocks the upload click and shows an error when no class is selected', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([]));
    const uploadResource = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource,
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    // No scheduled classes means no pill can be auto-selected as the upload target.
    const wrapper = mount(<ResourcesTab classes={[]} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-upload-file-button"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(uploadResource).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Selecciona una clase programada');
  });

  it('opens a viewable resource in a new tab pointed at its ResourceViewerPage route', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resource-view"]')
      .first()
      .simulate('click');

    expect(openSpy).toHaveBeenCalledWith('/dashboard/recursos/file-a/ver', '_blank');
    openSpy.mockRestore();
  });

  it('does not offer a "Ver" button for zip, the only kind with no preview', async () => {
    const zipFile = { ...fileA, id: 'file-zip', kind: 'zip' as const };
    const fetchResources = jest.fn(() => Promise.resolve([zipFile]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-resource-view"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dashboard-resource-download"]').exists()).toBe(true);
  });

  it('offers a "Ver" button for a word/presentation resource too (viewer page handles the conversion)', async () => {
    const wordFile = { ...fileA, id: 'file-word', kind: 'word' as const };
    const fetchResources = jest.fn(() => Promise.resolve([wordFile]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resource-view"]')
      .first()
      .simulate('click');

    expect(openSpy).toHaveBeenCalledWith('/dashboard/recursos/file-word/ver', '_blank');
    openSpy.mockRestore();
  });

  it('downloads the binary Blob using the original resource filename', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA]));
    const fetchResourceDownloadUrl = jest.fn(() =>
      Promise.resolve(new Blob(['contenido'], { type: 'application/pdf' }))
    );
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl,
      deleteResource: jest.fn(),
    }));
    const createObjectURL = jest.fn(() => 'blob:mock-url');
    const revokeObjectURL = jest.fn();
    let downloadedFileName = '';
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function(this: HTMLAnchorElement) {
        downloadedFileName = this.download;
      });
    // @ts-ignore jsdom does not implement these by default
    global.URL.createObjectURL = createObjectURL;
    // @ts-ignore
    global.URL.revokeObjectURL = revokeObjectURL;

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-resource-download"]')
        .first()
        .simulate('click');
    });

    expect(fetchResourceDownloadUrl).toHaveBeenCalledWith('file-a');
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(downloadedFileName).toBe('guia.pdf');
    clickSpy.mockRestore();
  });

  it('deletes a resource after confirming, removing it from the grid', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA]));
    const deleteResource = jest.fn(() => Promise.resolve());
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource,
    }));
    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resource-delete"]')
      .first()
      .simulate('click');
    wrapper.update();

    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-confirm-dialog-confirm"]')
        .first()
        .simulate('click');
    });
    wrapper.update();

    expect(deleteResource).toHaveBeenCalledWith('file-a');
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-a"]').exists()).toBe(false);
  });

  it('does not delete when the confirmation is declined', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA]));
    const deleteResource = jest.fn(() => Promise.resolve());
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource,
    }));
    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resource-delete"]')
      .first()
      .simulate('click');
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-confirm-dialog-cancel"]')
      .first()
      .simulate('click');

    expect(deleteResource).not.toHaveBeenCalled();
  });
});
