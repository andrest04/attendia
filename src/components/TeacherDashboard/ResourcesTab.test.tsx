import React from 'react';
import { act } from 'react-dom/test-utils';
import { I18nextProvider } from 'react-i18next';
import { mount } from 'enzyme';
import ResourcesTab from './ResourcesTab';
import { ClientApiError } from '../../state/useFirebaseAuth/apiClient';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
import { useAppState } from '../../state';
import i18n from '../../i18n/testInit';
import es from '../../i18n/locales/completeDashboard.es';
import en from '../../i18n/locales/completeDashboard.en';

i18n.addResourceBundle('es', 'completeDashboard', es, true, true);
i18n.addResourceBundle('en', 'completeDashboard', en, true, true);

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

  it('updates a displayed resource fetch error without refetching on language change', async () => {
    const fetchResources = jest.fn().mockRejectedValue(new ClientApiError(404, 'resource not found', 'Recurso no encontrado'));
    mockUseAppState.mockImplementation(() => ({ fetchResources, uploadResource: jest.fn(), fetchResourceDownloadUrl: jest.fn(), deleteResource: jest.fn() }));
    const wrapper = mount(<I18nextProvider i18n={i18n}><ResourcesTab classes={scheduledClasses} /></I18nextProvider>);
    try {
      await flushPromises();
      wrapper.update();
      expect(wrapper.text()).toContain('Recurso no encontrado');
      await act(async () => { setCurrentLanguage('en'); await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('The requested resource does not exist.');
      expect(fetchResources).toHaveBeenCalledTimes(1);
    } finally {
      setCurrentLanguage('es');
      await act(async () => { await i18n.changeLanguage('es'); });
      wrapper.unmount();
    }
  });

  it('translates selection and file-count validation already shown without uploading', async () => {
    const api = { fetchResources: jest.fn(() => Promise.resolve([])), uploadResource: jest.fn(), fetchResourceDownloadUrl: jest.fn(), deleteResource: jest.fn() };
    mockUseAppState.mockReturnValue(api);
    const wrapper = mount(<I18nextProvider i18n={i18n}><ResourcesTab classes={[]} /></I18nextProvider>);
    try {
      await flushPromises();
      wrapper.update();
      wrapper.find('[data-testid="dashboard-upload-file-button"]').hostNodes().simulate('click');
      expect(wrapper.text()).toContain('Selecciona una clase programada');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('Select a scheduled class');
      await act(async () => { await i18n.changeLanguage('es'); });
      wrapper.update();
      const files = Array.from({ length: 11 }, (_, i) => new File(['x'], `${i}.pdf`, { type: 'application/pdf' }));
      wrapper.find('[data-testid="dashboard-resources-file-input"]').hostNodes().simulate('change', { target: { files } });
      expect(wrapper.text()).toContain('Puedes subir hasta 10 archivos');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('You can upload up to 10 files');
      expect(api.uploadResource).not.toHaveBeenCalled();
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); });
      wrapper.unmount();
    }
  });

  it('translates individual file validation errors and keeps them dismissible', async () => {
    const api = { fetchResources: jest.fn(() => Promise.resolve([])), uploadResource: jest.fn(), fetchResourceDownloadUrl: jest.fn(), deleteResource: jest.fn() };
    mockUseAppState.mockReturnValue(api);
    const wrapper = mount(<I18nextProvider i18n={i18n}><ResourcesTab classes={scheduledClasses} /></I18nextProvider>);
    try {
      await flushPromises();
      wrapper.update();
      const large = new File(['x'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(large, 'size', { value: 26 * 1024 * 1024 });
      const invalid = new File(['x'], 'bad.exe', { type: 'application/x-msdownload' });
      wrapper.find('[data-testid="dashboard-resources-file-input"]').hostNodes().simulate('change', { target: { files: [large, invalid] } });
      expect(wrapper.text()).toContain('El archivo supera el tamaño máximo');
      expect(wrapper.text()).toContain('Tipo de archivo no admitido');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('The file exceeds the maximum allowed size');
      expect(wrapper.text()).toContain('Unsupported file type');
      wrapper.find('[data-testid="dashboard-resources-uploading-dismiss-upload-0"]').hostNodes().simulate('click');
      expect(wrapper.find('[data-testid="dashboard-resources-uploading-card-upload-0"]').exists()).toBe(false);
      expect(api.uploadResource).not.toHaveBeenCalled();
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); });
      wrapper.unmount();
    }
  });

  it('translates bulk partial-failure counts and retries only remaining files', async () => {
    const orphan = { ...fileA, classId: 'gone', classTitle: 'Historia' };
    const deleteResource = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failed')).mockResolvedValue(undefined);
    mockUseAppState.mockReturnValue({ fetchResources: jest.fn(() => Promise.resolve([orphan, { ...orphan, id: 'second' }])), uploadResource: jest.fn(), fetchResourceDownloadUrl: jest.fn(), deleteResource });
    const wrapper = mount(<I18nextProvider i18n={i18n}><ResourcesTab classes={[]} /></I18nextProvider>);
    try {
      await flushPromises(); wrapper.update();
      wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').hostNodes().simulate('click');
      await act(async () => { wrapper.find('[data-testid="dashboard-confirm-dialog-confirm"]').hostNodes().first().simulate('click'); });
      wrapper.update();
      expect(wrapper.text()).toContain('No pudimos eliminar 1 recurso.');
      await act(async () => { await i18n.changeLanguage('en'); }); wrapper.update();
      expect(wrapper.text()).toContain("We couldn't delete 1 resource.");
      wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').hostNodes().simulate('click');
      await act(async () => { wrapper.find('[data-testid="dashboard-confirm-dialog-confirm"]').hostNodes().first().simulate('click'); });
      wrapper.update();
      expect(deleteResource.mock.calls.map(call => call[0])).toEqual(['file-a', 'second', 'second']);
      expect(wrapper.find('[data-testid="dashboard-resources-bulk-delete-error"]').exists()).toBe(false);
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); }); wrapper.unmount();
    }
  });

  it('translates a message-less bulk class deletion failure and permits retry', async () => {
    const onDeleteClass = jest.fn().mockRejectedValueOnce(new Error('')).mockResolvedValue(undefined);
    mockUseAppState.mockReturnValue({ fetchResources: jest.fn(() => Promise.resolve([])), uploadResource: jest.fn(), fetchResourceDownloadUrl: jest.fn(), deleteResource: jest.fn() });
    const wrapper = mount(<I18nextProvider i18n={i18n}><ResourcesTab classes={[{ ...scheduledClasses[0], status: 'completed' }]} onDeleteClass={onDeleteClass} /></I18nextProvider>);
    try {
      await flushPromises(); wrapper.update();
      wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').hostNodes().simulate('click');
      await act(async () => { wrapper.find('[data-testid="dashboard-confirm-dialog-confirm"]').hostNodes().first().simulate('click'); });
      wrapper.update();
      expect(wrapper.text()).toContain('No pudimos eliminar la clase.');
      await act(async () => { await i18n.changeLanguage('en'); }); wrapper.update();
      expect(wrapper.text()).toContain("We couldn't delete the class.");
      wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').hostNodes().simulate('click');
      await act(async () => { wrapper.find('[data-testid="dashboard-confirm-dialog-confirm"]').hostNodes().first().simulate('click'); });
      wrapper.update();
      expect(onDeleteClass).toHaveBeenCalledTimes(2);
      expect(wrapper.find('[data-testid="dashboard-resources-bulk-delete-error"]').exists()).toBe(false);
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); }); wrapper.unmount();
    }
  });

  it('translates a destructive confirmation with its file count while open', async () => {
    const orphan = { ...fileA, classId: 'gone', classTitle: 'Historia' };
    const api = { fetchResources: jest.fn(() => Promise.resolve([orphan, { ...orphan, id: 'second' }])), uploadResource: jest.fn(), fetchResourceDownloadUrl: jest.fn(), deleteResource: jest.fn() };
    mockUseAppState.mockImplementation(() => api);
    const wrapper = mount(<I18nextProvider i18n={i18n}><ResourcesTab classes={[]} /></I18nextProvider>);
    await flushPromises();
    wrapper.update();
    wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').hostNodes().simulate('click');
    wrapper.update();
    expect(wrapper.find('ConfirmDialog').at(1).prop('message')).toBe('¿Eliminar los 2 archivos de "Historia"? Esta acción no se puede deshacer.');
    try {
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.find('ConfirmDialog').at(1).prop('message')).toBe('Delete the 2 files from "Historia"? This action cannot be undone.');
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); });
      wrapper.unmount();
    }
  });

  it('updates resource controls when the language changes', async () => {
    const api = { fetchResources: jest.fn(() => Promise.resolve([])), uploadResource: jest.fn(), fetchResourceDownloadUrl: jest.fn(), deleteResource: jest.fn() };
    mockUseAppState.mockImplementation(() => api);
    const wrapper = mount(<I18nextProvider i18n={i18n}><ResourcesTab classes={scheduledClasses} /></I18nextProvider>);
    await flushPromises();
    wrapper.update();
    expect(wrapper.text()).toContain('Subir archivo');
    try {
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('Upload file');
      expect(wrapper.text()).toContain('Materials associated with scheduled classes');
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); });
      wrapper.unmount();
    }
  });

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

  it('exposes the selected filter while retaining class names and filtering across languages', async () => {
    mockUseAppState.mockReturnValue({ fetchResources: jest.fn(() => Promise.resolve([fileA, fileB])), uploadResource: jest.fn(), fetchResourceDownloadUrl: jest.fn(), deleteResource: jest.fn() });
    const wrapper = mount(<I18nextProvider i18n={i18n}><ResourcesTab classes={scheduledClasses} /></I18nextProvider>);
    try {
      await flushPromises(); wrapper.update();
      const pill = (id: string) => wrapper.find(`[data-testid="dashboard-resources-pill-${id}"]`).hostNodes();
      expect(pill('class-a').prop('aria-pressed')).toBe(true);
      expect(pill('class-b').prop('aria-pressed')).toBe(false);
      expect(pill('class-a').text()).toContain('Cálculo I');
      pill('class-b').simulate('click'); wrapper.update();
      expect(pill('class-a').prop('aria-pressed')).toBe(false);
      expect(pill('class-b').prop('aria-pressed')).toBe(true);
      expect(wrapper.find('[data-testid="dashboard-resource-file-file-b"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="dashboard-resource-file-file-a"]').exists()).toBe(false);
      await act(async () => { await i18n.changeLanguage('en'); }); wrapper.update();
      expect(pill('class-b').prop('aria-pressed')).toBe(true);
      expect(pill('class-b').text()).toContain('Física II');
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); }); wrapper.unmount();
    }
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

  it('does not offer bulk delete for a still-active, non-expired class', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={scheduledClasses} />);
    await flushPromises();
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').exists()).toBe(false);
  });

  it('offers bulk delete for a cancelled class and clears every one of its files at once', async () => {
    const orphanFile = { ...fileA, id: 'file-orphan', classId: 'class-gone', classTitle: 'Historia' };
    const fetchResources = jest.fn(() => Promise.resolve([orphanFile]));
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
      .find('[data-testid="dashboard-resources-pill-class-gone"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-resources-pill-cancelled-class-gone"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').exists()).toBe(true);

    wrapper
      .find('[data-testid="dashboard-resources-bulk-delete-button"]')
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

    expect(deleteResource).toHaveBeenCalledWith('file-orphan');
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-orphan"]').exists()).toBe(false);
    // The cancelled class had no files left, so its pill stopped existing entirely.
    expect(wrapper.find('[data-testid="dashboard-resources-pill-class-gone"]').exists()).toBe(false);
  });

  it('offers bulk delete for a vencida (expired) class, tagged the same way as cancelled ones', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA]));
    const deleteResource = jest.fn(() => Promise.resolve());
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource,
    }));

    const wrapper = mount(
      <ResourcesTab classes={scheduledClasses} expiredClassIds={new Set(['class-a'])} onDeleteClass={jest.fn()} />
    );
    await flushPromises();
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-resources-pill-expired-class-a"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').exists()).toBe(true);
  });

  it('tags an already-taught (completed) class and offers bulk delete for it too', async () => {
    const completedClasses = [
      { ...scheduledClasses[0], status: 'completed' as const },
      scheduledClasses[1],
    ];
    const fetchResources = jest.fn(() => Promise.resolve([fileA]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={completedClasses} onDeleteClass={jest.fn()} />);
    await flushPromises();
    wrapper.update();

    // Completed classes are neither "cancelada" (the doc still exists) nor "vencida"
    // (they did happen) — they get their own tag, and the pill still isn't gone from
    // Recursos because its docs/resources are just as real as any other class's.
    expect(wrapper.find('[data-testid="dashboard-resources-pill-completed-class-a"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resources-pill-expired-class-a"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').exists()).toBe(true);
  });

  it('offers "Eliminar clase" for a completed class with zero resources, and removes it via onDeleteClass', async () => {
    const completedClasses = [{ ...scheduledClasses[0], status: 'completed' as const }, scheduledClasses[1]];
    const fetchResources = jest.fn(() => Promise.resolve([])); // no files at all for class-a
    const onDeleteClass = jest.fn(() => Promise.resolve());
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab classes={completedClasses} onDeleteClass={onDeleteClass} />);
    await flushPromises();
    wrapper.update();

    // class-a (completed, 0 resources) is the default-selected pill.
    expect(wrapper.find('[data-testid="dashboard-resources-bulk-delete-button"]').text()).toContain('Eliminar clase');

    wrapper
      .find('[data-testid="dashboard-resources-bulk-delete-button"]')
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

    expect(onDeleteClass).toHaveBeenCalledWith('class-a');
  });

  it('surfaces a partial-failure message when some files fail to delete in bulk', async () => {
    const orphanFileA = { ...fileA, id: 'file-orphan-a', classId: 'class-gone', classTitle: 'Historia' };
    const orphanFileB = { ...fileB, id: 'file-orphan-b', classId: 'class-gone', classTitle: 'Historia' };
    const fetchResources = jest.fn(() => Promise.resolve([orphanFileA, orphanFileB]));
    const deleteResource = jest.fn((id: string) =>
      id === 'file-orphan-a' ? Promise.resolve() : Promise.reject(new Error('nope'))
    );
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
      .find('[data-testid="dashboard-resources-pill-class-gone"]')
      .first()
      .simulate('click');
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resources-bulk-delete-button"]')
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

    expect(wrapper.find('[data-testid="dashboard-resource-file-file-orphan-a"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-orphan-b"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resources-bulk-delete-error"]').text()).toContain(
      'No pudimos eliminar 1 recurso.'
    );
  });
});
