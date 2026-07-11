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
  sizeBytes: 2_500_000,
  contentType: 'application/pdf',
  createdAtMs: 1751554800000,
};

const fileB = {
  id: 'file-b',
  name: 'clase.mp4',
  kind: 'video' as const,
  roomLabel: 'Física II',
  sizeBytes: 500,
  contentType: 'video/mp4',
  createdAtMs: null,
};

describe('the ResourcesTab component', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a fallback message when the real resources API is not available (non-firebase auth modes)', () => {
    mockUseAppState.mockImplementation(() => ({}));
    const wrapper = mount(<ResourcesTab />);

    expect(wrapper.text()).toContain('Los recursos reales solo están disponibles');
  });

  it('fetches and groups resources by roomLabel on mount, defaulting to the first group', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA, fileB]));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab />);
    await flushPromises();
    wrapper.update();

    expect(fetchResources).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="dashboard-resources-pill-calculo-i"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resources-pill-fisica-ii"]').exists()).toBe(true);
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

    const wrapper = mount(<ResourcesTab />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resources-pill-fisica-ii"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-resource-file-file-b"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-a"]').exists()).toBe(false);
  });

  it('uploads the selected file under the typed roomLabel and prepends it to the active group', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([]));
    const uploadResource = jest.fn(() => Promise.resolve(fileA));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource,
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resources-room-label-input"]')
      .first()
      .simulate('change', { target: { value: 'Cálculo I' } });

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

    expect(uploadResource).toHaveBeenCalledWith(file, 'Cálculo I');
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-a"]').exists()).toBe(true);
  });

  it('blocks the upload click and shows an error when no roomLabel was typed', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([]));
    const uploadResource = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource,
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource: jest.fn(),
    }));

    const wrapper = mount(<ResourcesTab />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-upload-file-button"]')
      .first()
      .simulate('click');
    wrapper.update();

    expect(uploadResource).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Indicá a qué clase pertenece el archivo');
  });

  it('opens the signed download url in a new tab', async () => {
    const fetchResources = jest.fn(() => Promise.resolve([fileA]));
    const fetchResourceDownloadUrl = jest.fn(() => Promise.resolve('https://storage.example.com/signed'));
    mockUseAppState.mockImplementation(() => ({
      fetchResources,
      uploadResource: jest.fn(),
      fetchResourceDownloadUrl,
      deleteResource: jest.fn(),
    }));
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    const wrapper = mount(<ResourcesTab />);
    await flushPromises();
    wrapper.update();

    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-resource-download"]')
        .first()
        .simulate('click');
    });

    expect(fetchResourceDownloadUrl).toHaveBeenCalledWith('file-a');
    expect(openSpy).toHaveBeenCalledWith('https://storage.example.com/signed', '_blank', 'noopener');
    openSpy.mockRestore();
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
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(<ResourcesTab />);
    await flushPromises();
    wrapper.update();

    await act(async () => {
      wrapper
        .find('[data-testid="dashboard-resource-delete"]')
        .first()
        .simulate('click');
    });
    wrapper.update();

    expect(deleteResource).toHaveBeenCalledWith('file-a');
    expect(wrapper.find('[data-testid="dashboard-resource-file-file-a"]').exists()).toBe(false);
    confirmSpy.mockRestore();
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
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    const wrapper = mount(<ResourcesTab />);
    await flushPromises();
    wrapper.update();

    wrapper
      .find('[data-testid="dashboard-resource-delete"]')
      .first()
      .simulate('click');

    expect(deleteResource).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
