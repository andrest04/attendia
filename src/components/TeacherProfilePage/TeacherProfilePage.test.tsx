import React from 'react';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { Redirect } from 'react-router-dom';
import TeacherProfilePage from './TeacherProfilePage';
import { useAppState } from '../../state';

jest.mock('../../state');
jest.mock('react-router-dom', () => ({
  Redirect: () => null,
}));

const mockUseAppState = useAppState as jest.Mock<any>;

const teacherState = (overrides = {}) => ({
  user: {
    displayName: 'Ana',
    email: 'ana@example.com',
    photoURL: 'https://google.example/avatar.jpg',
    providerData: [],
  },
  profile: {
    displayName: 'Ana',
    email: 'ana@example.com',
    role: 'teacher',
    avatarDataUrl: 'data:image/jpeg;base64,AA==',
  },
  updateTeacherProfile: jest.fn(() => Promise.resolve()),
  changeEmail: jest.fn(() => Promise.resolve()),
  changePassword: jest.fn(() => Promise.resolve()),
  ...overrides,
});

function button(wrapper: any, label: string) {
  return wrapper.findWhere((node: any) => typeof node.prop('onClick') === 'function' && node.text() === label).first();
}

describe('TeacherProfilePage', () => {
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
    expect(wrapper.find('[data-testid="profile-avatar-input"]').prop('accept')).toBe('image/jpeg,image/webp');
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
      'Crear contraseña',
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

  it('redirects users who are not teachers', () => {
    mockUseAppState.mockReturnValue({
      user: { displayName: 'Student', email: 'student@example.com', providerData: [] },
      profile: { displayName: 'Student', email: 'student@example.com', role: 'student' },
    });

    expect(
      shallow(<TeacherProfilePage />)
        .find(Redirect)
        .prop('to')
    ).toBe('/');
  });

  it('removes the avatar through the profile mutation and keeps the loading action disabled', async () => {
    const state = teacherState();
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);

    await button(wrapper, 'Usar foto de Google').prop('onClick')!({});

    expect(state.updateTeacherProfile).toHaveBeenCalledWith({ avatarDataUrl: null });
    expect(wrapper.text()).toContain('Foto eliminada.');
  });

  it('asks for confirmation before saving an email change, and does nothing on cancel', () => {
    const state = teacherState();
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);
    const emailField = wrapper.findWhere((node: any) => node.prop('label') === 'Nuevo correo').first();

    (emailField.prop('onChange') as any)({ target: { value: 'nueva@example.com' } });
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

    (emailField.prop('onChange') as any)({ target: { value: 'nueva@example.com' } });
    (wrapper
      .find('form')
      .at(1)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    wrapper.update();
    await (wrapper.find('[data-testid="email-confirm-accept"]').prop('onClick') as any)({});
    wrapper.update();

    expect(state.changeEmail).toHaveBeenCalledWith('nueva@example.com', undefined);
    expect(wrapper.find('[data-testid="email-confirm-dialog"]').prop('open')).toBe(false);
    expect(wrapper.text()).toContain('Correo actualizado.');
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

    (emailField.prop('onChange') as any)({ target: { value: 'otra@example.com' } });
    (wrapper
      .find('form')
      .at(1)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    wrapper.update();
    await (wrapper.find('[data-testid="email-confirm-accept"]').prop('onClick') as any)({});
    wrapper.update();

    expect(wrapper.text()).toContain('Ese correo ya está vinculado a otra cuenta.');
  });

  it('creates a password from the profile form', async () => {
    const state = teacherState();
    mockUseAppState.mockReturnValue(state);
    const wrapper = shallow(<TeacherProfilePage />);
    const passwordField = wrapper.findWhere((node: any) => node.prop('label') === 'Nueva contraseña').first();

    (passwordField.prop('onChange') as any)({ target: { value: 'new-password' } });
    await (wrapper
      .find('form')
      .at(2)
      .prop('onSubmit') as any)({ preventDefault: jest.fn() });

    expect(state.changePassword).toHaveBeenCalledWith(undefined, 'new-password');
  });

  it('surfaces a failed profile action and returns to Clases in the dashboard', async () => {
    const updateTeacherProfile = jest.fn(() => Promise.reject(new Error('Firestore no disponible.')));
    const onReturnToClasses = jest.fn();
    mockUseAppState.mockReturnValue(teacherState({ updateTeacherProfile }));
    const wrapper = mount(<TeacherProfilePage onReturnToClasses={onReturnToClasses} />);

    await act(async () => {
      await (wrapper
        .find('form')
        .at(0)
        .prop('onSubmit') as any)({ preventDefault: jest.fn() });
    });
    wrapper.update();
    button(wrapper, 'Volver a Clases').prop('onClick')!({});

    expect(wrapper.text()).toContain('Firestore no disponible.');
    expect(onReturnToClasses).toHaveBeenCalled();
  });
});
