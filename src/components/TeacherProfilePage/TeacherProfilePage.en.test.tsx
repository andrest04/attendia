import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { createI18n } from '../../i18n/createI18n';
import { useAppState } from '../../state';
import TeacherProfilePage from './TeacherProfilePage';
import { cropToBudgetedBlob } from './avatarCropUtils';

jest.mock('../../state');
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('./AvatarCropModal', () => ({ __esModule: true, default: () => null }));

const mockUseAppState = useAppState as jest.Mock<any>;

const state = (role: 'teacher' | 'student') => ({
  user: {
    uid: 'u1',
    email: 'ana@example.com',
    displayName: 'Ana',
    photoURL: null,
    providerData: [{ providerId: 'google.com' }],
  },
  profile: { role, displayName: 'Ana', email: 'ana@example.com' },
  updateTeacherProfile: jest.fn(),
  uploadAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
  restoreProviderPhoto: jest.fn(),
  changeEmail: jest.fn(),
  changePassword: jest.fn(),
  signOut: jest.fn(),
});

describe('TeacherProfilePage in English', () => {
  let wrapper: ReactWrapper | undefined;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  const render = (role: 'teacher' | 'student') => {
    mockUseAppState.mockImplementation(() => state(role));
    return mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <MemoryRouter>
          <TeacherProfilePage />
        </MemoryRouter>
      </I18nextProvider>
    );
  };

  it('uses the role context for the title and translates the sections', () => {
    wrapper = render('teacher');
    const text = wrapper.text();
    expect(text).toContain('Teacher profile');
    expect(text).toContain('Manage your identity and access.');
    expect(text).toContain('Change photo');
    expect(text).toContain('Save name');
    expect(text).toContain('Create a password to enable changing your email.');
    expect(text).toContain('Your account uses Google. Create a password first to change your email.');
    expect(text).toContain('Create password');
    wrapper.unmount();

    wrapper = render('student');
    expect(wrapper.text()).toContain('Student profile');
    expect(
      wrapper
        .find('[data-testid="student-room-entry"]')
        .first()
        .text()
    ).toBe('Back to joining a room');
    expect(wrapper.find('select[aria-label="Language"]').exists()).toBe(true);
  });
});

describe('cropToBudgetedBlob errors', () => {
  const originalImage = (global as any).Image;
  afterEach(() => {
    (global as any).Image = originalImage;
  });

  it('reports an unreadable image in the translator language', async () => {
    (global as any).Image = class {
      onerror: () => void = () => {};
      set src(_value: string) {
        setTimeout(() => this.onerror(), 0);
      }
    };
    const en = createI18n({ detect: false, lng: 'en' });
    await expect(cropToBudgetedBlob('x', { x: 0, y: 0, width: 10, height: 10 }, en.t)).rejects.toThrow(
      'The image is not valid.'
    );
    await expect(cropToBudgetedBlob('x', { x: 0, y: 0, width: 10, height: 10 })).rejects.toThrow(
      'La imagen no es válida.'
    );
  });
});
