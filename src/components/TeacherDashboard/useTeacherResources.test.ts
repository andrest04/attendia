import { act, renderHook } from '@testing-library/react-hooks';
import useTeacherResources from './useTeacherResources';
import { useAppState } from '../../state';

jest.mock('../../state');

const mockUseAppState = useAppState as jest.Mock<any>;

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
];

const makeFile = (name: string) => ({ name } as File);

describe('the useTeacherResources hook', () => {
  let fetchResources: jest.Mock;
  let uploadResource: jest.Mock;
  let deleteResource: jest.Mock;

  beforeEach(() => {
    fetchResources = jest.fn(() => Promise.resolve([fileA]));
    uploadResource = jest.fn();
    deleteResource = jest.fn(() => Promise.resolve());
    mockUseAppState.mockReturnValue({
      fetchResources,
      uploadResource,
      fetchResourceDownloadUrl: jest.fn(),
      deleteResource,
    });
  });
  afterEach(() => jest.clearAllMocks());

  const setup = async () => {
    const hook = renderHook(() => useTeacherResources({ scheduledClasses }));
    await hook.waitForNextUpdate();
    return hook;
  };

  it('loads the resources, groups them by class and activates the first pill', async () => {
    const { result } = await setup();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.activeClassId).toBe('class-a');
    expect(result.current.activeGroup?.files).toEqual([fileA]);
  });

  it('reports the fetch failure message and stops loading', async () => {
    fetchResources.mockImplementation(() => Promise.reject(new Error('boom')));
    const { result } = await setup();

    expect(result.current.errorMessage).toBe('boom');
    expect(result.current.isLoading).toBe(false);
  });

  it('is unavailable (and not loading) without the real resources API', () => {
    mockUseAppState.mockReturnValue({});
    const { result } = renderHook(() => useTeacherResources({ scheduledClasses }));

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('prepends an uploaded resource and clears its progress entry on success', async () => {
    const created = { ...fileA, id: 'file-new', name: 'nuevo.pdf' };
    let reportProgress: (percent: number) => void = () => {};
    let resolveUpload: (value: typeof created) => void = () => {};
    uploadResource.mockImplementation((_file, _classId, onProgress) => {
      reportProgress = onProgress;
      return new Promise(resolve => {
        resolveUpload = resolve;
      });
    });
    const { result } = await setup();

    act(() => {
      result.current.startUpload(makeFile('nuevo.pdf'), 'class-a');
    });
    expect(result.current.uploadingFiles).toEqual([{ id: 'upload-0', name: 'nuevo.pdf', progress: 0, error: null }]);

    act(() => reportProgress(40));
    expect(result.current.uploadingFiles[0].progress).toBe(40);

    await act(async () => resolveUpload(created));
    expect(result.current.uploadingFiles).toEqual([]);
    expect(result.current.activeGroup?.files.map(f => f.id)).toEqual(['file-new', 'file-a']);
  });

  it('keeps a failed upload in the list with its error until dismissed', async () => {
    uploadResource.mockImplementation(() => Promise.reject(new Error('demasiado grande')));
    const { result } = await setup();

    await act(async () => {
      result.current.startUpload(makeFile('malo.pdf'), 'class-a');
    });
    expect(result.current.uploadingFiles[0]).toMatchObject({ name: 'malo.pdf', error: 'demasiado grande' });

    act(() => result.current.removeUploadEntry('upload-0'));
    expect(result.current.uploadingFiles).toEqual([]);
  });

  it('removes a resource from the list after confirming its deletion', async () => {
    const { result } = await setup();

    act(() => result.current.handleDelete(fileA));
    expect(result.current.deleteDialog.isOpen).toBe(true);

    await act(async () => {
      result.current.confirmDelete();
    });
    expect(deleteResource).toHaveBeenCalledWith('file-a');
    expect(result.current.activeGroup).toBeUndefined();
    expect(result.current.deleteDialog.isOpen).toBe(false);
  });

  it('surfaces the delete error and keeps the resource when deletion fails', async () => {
    deleteResource.mockImplementation(() => Promise.reject(new Error('no se pudo')));
    const { result } = await setup();

    act(() => result.current.handleDelete(fileA));
    await act(async () => {
      result.current.confirmDelete();
    });
    expect(result.current.errorMessage).toBe('no se pudo');
    expect(result.current.activeGroup?.files).toEqual([fileA]);
  });
});
