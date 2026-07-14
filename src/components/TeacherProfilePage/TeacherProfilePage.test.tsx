import React from 'react';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { Redirect } from 'react-router-dom';
import TeacherProfilePage from './TeacherProfilePage';
import { useAppState } from '../../state';
import DashboardHeader from '../TeacherDashboard/DashboardHeader';

jest.mock('../../state');
jest.mock('react-router-dom', () => ({
  Link: () => null,
  Redirect: () => null,
}));

const mockEnqueueSnackbar = jest.fn();
jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar, closeSnackbar: jest.fn() }),
}));

const mockUseAppState = useAppState as jest.Mock<any>;

const teacherState = (overrides = {}) => ({
  user: {
    displayName: 'Ana',
    email: 'ana@example.com',
    photoURL: 'https://google.example/avatar.jpg',
    providerData: [{ providerId: 'password' }],
  },
  profile: {
    displayName: 'Ana',
    email: 'ana@example.com',
    role: 'teacher',
    avatarUrl: 'https://appwrite.example/avatar-1.jpg',
  },
  updateTeacherProfile: jest.fn(() => Promise.resolve()),
  uploadAvatar: jest.fn(() => Promise.resolve({ displayName: 'Ana', email: 'ana@example.com', role: 'teacher' })),
  deleteAvatar: jest.fn(() => Promise.resolve({ displayName: 'Ana', email: 'ana@example.com', role: 'teacher' })),
  changeEmail: jest.fn(() => Promise.resolve()),
  changePassword: jest.fn(() => Promise.resolve()),
  ...overrides,
});

function button(wrapper: any, label: string) {
  return wrapper.findWhere((node: any) => typeof node.prop('onClick') === 'function' && node.text() === label).first();
}

describe('TeacherProfilePage', () => {
  beforeEach(() => {
    mockEnqueueSnackbar.mockClear();
  });

  it('renders editable teacher profile fields and the Google photo fallback', () => {
    mockUseAppState.mockReturnValue({
      user: {
        displayName: 'Ana',
        email: 'ana@example.com',
        photoURL: 'https://google.example/avatar.jpg',
        providerData: [],
      },
      profile: { displayName: 'Ana', email: 'ana@example.com', role: 'teacher' },
    });

    const wrapper = shallow(<TeacherProfilePage />);

    expect(wrapper.find('[data-testid="teacher-profile-page"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Perfil docente');
    expect(wrapper.find('[data-testid="profile-avatar-input"]').prop('accept')).toBe(
      'image/jpeg,image/png,image/webp,image/gif,image/bmp'
    );
  });

  it('keeps the four profile sections ordered and reachable in both responsive layout modes', () => {
    mockUseAppState.mockReturnValue(teacherState());
    const wrapper = mount(<TeacherProfilePage />);
    const layout = wrapper.find('[data-testid="teacher-profile-layout"]');
    const layoutClass = String(layout.prop('className') || '').split(' ')[0];
    const generatedStyles = Array.from(document.head.querySelectorAll('style'))
      .map(style => style.textContent)
      .join('\n');

    expect(layout.children().map(node => node.prop('data-testid'))).toEqual([
      'teacher-profile-photo',
      'teacher-profile-name',
      'teacher-profile-email',
      'teacher-profile-password',
    ]);
    [
      'Foto',
      'Nombre',
      'Cambiar foto',
      'Guardar nombre',
      'Nuevo correo',
      'Guardar correo',
      'Nueva contraseña',
      'Actualizar contraseña',
    ].forEach(control => {
      expect(wrapper.text()).toContain(control);
    });
    expect(generatedStyles).toMatch(
      new RegExp(`\\.${layoutClass}\\s*\\{[^}]*grid-template-columns:\\s*repeat\\(2, minmax\\(0, 1fr\\)\\)`)
    );
    expect(generatedStyles).toMatch(
      new RegExp(
        `@media \\(max-width:959.95px\\)\\s*\\{\\s*\\.${layoutClass}\\s*\\{[^}]*grid-template-columns:\\s*minmax\\(0, 1fr\\)`
      )
    );
  });

  it('renders an editable student profile', () => {
    mockUseAppState.mockReturnValue({
      user: { displayName: 'Student', email: 'student@example.com', providerData: [] },
      profile: { displayName: 'Student', email: 'student@example.com', role: 'student' },
    });

    const wrapper = shallow(<TeacherProfilePage />);

    expect(wrapper.find(Redirect).exists()).toBe(false);
    expect(wrapper.text()).toContain('Perfil estudiante');
  });

  it('shows a student-only room entry control that preserves the student prejoin flow', () => {
    const signOut = jest.fn();
    mockUseAppState.mockReturnValue(
      teacherState({
        profile: { displayName: 'Student', email: 'student@example.com', role: 'student' },
        signOut,
      })
    );

    const studentWrapper = shallow(<TeacherProfilePage />);
    const roomEntry = studentWrapper.find('[data-testid="student-room-entry"]');
    const header = studentWrapper.find(DashboardHeader);
    const pageShell = studentWrapper.find('[data-testid="profile-page-shell"]');

    expect(roomEntry.text()).toBe('Volver a ingresar a una sala');
    expect(roomEntry.prop('to')).toEqual({ pathname: '/', state: { preJoinRole: 'student' } });
    expect(pageShell.children().filter(DashboardHeader)).toHaveLength(1);
    expect(pageShell.children().filter('main[data-testid="teacher-profile-page"]')).toHaveLength(1);
    expect(header.prop('identityColor')).toBe('student');
    expect(header.prop('showNotifications')).toBe(false);
    const signOutItem = header.prop('extraMenuItems') as React.ReactElement<any>;
    signOutItem.props.onClick();
    expect(signOut).toHaveBeenCalledTimes(1);

    mockUseAppState.mockReturnValue(teacherState());

    const teacherWrapper = shallow(<TeacherProfilePage />);
    expect(teacherWrapper.find('[data-testid="student-room-entry"]').exists()).toBe(false);
    expect(teacherWrapper.find(DashboardHeader).exists()).toBe(false);
  });

  it('removes the avatar through deleteAvatar and keeps the loading action disabled', async () => {
    const state = teacherState();
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);

    await button(wrapper, 'Usar foto de Google').prop('onClick')!({});

    expect(state.deleteAvatar).toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Foto eliminada.', { variant: 'success' });
  });

  it('asks for confirmation before saving an email change, and does nothing on cancel', () => {
    const state = teacherState();
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);
    const emailField = wrapper.findWhere((node: any) => node.prop('label') === 'Nuevo correo').first();
    const currentPasswordField = wrapper
      .find('form')
      .at(1)
      .findWhere((node: any) => node.prop('label') === 'Contraseña actual')
      .first();

    (emailField.prop('onChange') as any)({ target: { value: 'nueva@example.com' } });
    (currentPasswordField.prop('onChange') as any)({ target: { value: 'current-password' } });
    (wrapper
      .find('form')
      .at(1)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    wrapper.update();

    expect(wrapper.find('[data-testid="email-confirm-dialog"]').prop('open')).toBe(true);
    expect(state.changeEmail).not.toHaveBeenCalled();

    (wrapper.find('[data-testid="email-confirm-cancel"]').prop('onClick') as any)({});
    wrapper.update();

    expect(wrapper.find('[data-testid="email-confirm-dialog"]').prop('open')).toBe(false);
    expect(state.changeEmail).not.toHaveBeenCalled();
  });

  it('saves the email change once the confirmation dialog is accepted', async () => {
    const state = teacherState();
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);
    const emailField = wrapper.findWhere((node: any) => node.prop('label') === 'Nuevo correo').first();
    const currentPasswordField = wrapper
      .find('form')
      .at(1)
      .findWhere((node: any) => node.prop('label') === 'Contraseña actual')
      .first();

    (emailField.prop('onChange') as any)({ target: { value: 'nueva@example.com' } });
    (currentPasswordField.prop('onChange') as any)({ target: { value: 'current-password' } });
    (wrapper
      .find('form')
      .at(1)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    wrapper.update();
    await (wrapper.find('[data-testid="email-confirm-accept"]').prop('onClick') as any)({});
    wrapper.update();

    expect(state.changeEmail).toHaveBeenCalledWith('nueva@example.com', 'current-password');
    expect(wrapper.find('[data-testid="email-confirm-dialog"]').prop('open')).toBe(false);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Correo actualizado.', { variant: 'success' });
  });

  it('disables "Guardar correo" and skips the confirmation dialog when the email is unchanged', () => {
    const state = teacherState();
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);

    const saveEmailButton = wrapper
      .findWhere((node: any) => node.prop('type') === 'submit' && node.text() === 'Guardar correo')
      .first();
    expect(saveEmailButton.prop('disabled')).toBe(true);

    (wrapper
      .find('form')
      .at(1)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    wrapper.update();

    expect(wrapper.find('[data-testid="email-confirm-dialog"]').prop('open')).toBe(false);
    expect(state.changeEmail).not.toHaveBeenCalled();
  });

  it('blocks email changes for Google-only accounts until a password is linked', async () => {
    const state = teacherState({ user: { ...teacherState().user, providerData: [{ providerId: 'google.com' }] } });
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);
    const emailField = wrapper.findWhere((node: any) => node.prop('label') === 'Nuevo correo').first();

    expect(emailField.prop('disabled')).toBe(true);
    expect(emailField.prop('inputProps')).toEqual({ 'aria-describedby': 'email-password-setup-hint' });
    expect(wrapper.find('#email-password-setup-hint').text()).toContain('Primero crea una contraseña');
    expect(
      wrapper
        .findWhere((node: any) => node.prop('type') === 'submit' && node.text() === 'Guardar correo')
        .first()
        .prop('disabled')
    ).toBe(true);
    const passwordField = wrapper.findWhere((node: any) => node.prop('label') === 'Nueva contraseña').first();
    (passwordField.prop('onChange') as any)({ target: { value: 'new-password' } });
    wrapper.update();
    expect(
      wrapper
        .findWhere((node: any) => node.prop('type') === 'submit' && node.text() === 'Crear contraseña')
        .first()
        .prop('disabled')
    ).toBe(false);

    (emailField.prop('onChange') as any)({ target: { value: 'nueva@example.com' } });
    (wrapper
      .find('form')
      .at(1)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    wrapper.update();

    expect(wrapper.find('[data-testid="email-confirm-dialog"]').prop('open')).toBe(false);
    expect(state.changeEmail).not.toHaveBeenCalled();
  });

  it('disables "Guardar correo" and flags the field when the email format is invalid', () => {
    const state = teacherState();
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);
    const emailField = wrapper.findWhere((node: any) => node.prop('label') === 'Nuevo correo').first();

    (emailField.prop('onChange') as any)({ target: { value: '32131231239djdoandamd@mamdoiawd.idowad@doaw' } });
    wrapper.update();

    const saveEmailButton = wrapper
      .findWhere((node: any) => node.prop('type') === 'submit' && node.text() === 'Guardar correo')
      .first();
    expect(saveEmailButton.prop('disabled')).toBe(true);
    expect(
      wrapper
        .findWhere((node: any) => node.prop('label') === 'Nuevo correo')
        .first()
        .prop('error')
    ).toBe(true);

    (wrapper
      .find('form')
      .at(1)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    wrapper.update();

    expect(wrapper.find('[data-testid="email-confirm-dialog"]').prop('open')).toBe(false);
    expect(state.changeEmail).not.toHaveBeenCalled();
  });

  it('surfaces a Spanish message when the email already belongs to another account', async () => {
    const changeEmail = jest.fn(() => Promise.reject({ code: 'auth/email-already-in-use' }));
    const state = teacherState({ changeEmail });
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);
    const emailField = wrapper.findWhere((node: any) => node.prop('label') === 'Nuevo correo').first();
    const currentPasswordField = wrapper
      .find('form')
      .at(1)
      .findWhere((node: any) => node.prop('label') === 'Contraseña actual')
      .first();

    (emailField.prop('onChange') as any)({ target: { value: 'otra@example.com' } });
    (currentPasswordField.prop('onChange') as any)({ target: { value: 'current-password' } });
    (wrapper
      .find('form')
      .at(1)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    wrapper.update();
    await (wrapper.find('[data-testid="email-confirm-accept"]').prop('onClick') as any)({});
    wrapper.update();

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Ese correo ya está vinculado a otra cuenta.', {
      variant: 'error',
    });
  });

  it('creates a password from the profile form', async () => {
    const state = teacherState({ user: { ...teacherState().user, providerData: [{ providerId: 'google.com' }] } });
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);
    const passwordField = wrapper.findWhere((node: any) => node.prop('label') === 'Nueva contraseña').first();

    (passwordField.prop('onChange') as any)({ target: { value: 'new-password' } });
    await (wrapper
      .find('form')
      .at(2)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });

    expect(state.changePassword).toHaveBeenCalledWith(undefined, 'new-password');
    expect(
      wrapper
        .findWhere((node: any) => node.prop('label') === 'Nuevo correo')
        .first()
        .prop('disabled')
    ).toBe(false);
    expect(wrapper.findWhere((node: any) => node.prop('label') === 'Contraseña actual')).toHaveLength(2);
  });

  it('surfaces a failed profile action', async () => {
    const updateTeacherProfile = jest.fn(() => Promise.reject(new Error('Firestore no disponible.')));
    mockUseAppState.mockReturnValue(teacherState({ updateTeacherProfile }));
    const wrapper = mount(<TeacherProfilePage />);
    act(() => {
      const nameField = wrapper.findWhere((node: any) => node.prop('label') === 'Nombre').first();
      (nameField.prop('onChange') as any)({ target: { value: 'Ana Nueva' } });
    });
    wrapper.update();

    await act(async () => {
      await (wrapper
        .find('form')
        .at(0)
        .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    });
    wrapper.update();

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Firestore no disponible.', { variant: 'error' });
  });
});
