import React from 'react';
import RoomNameScreen from './RoomNameScreen';
import { shallow } from 'enzyme';
import { Button, TextField } from '@material-ui/core';
import { Link as RouterLink } from 'react-router-dom';
import { useAppState } from '../../../state';
import { createDefaultClassSessionDraft } from '../classSessionTypes';

jest.mock('../../../state');
const mockUseAppState = useAppState as jest.Mock<any>;

describe('the RoomNameScreen component', () => {
  const baseTeacherDraft = {
    ...createDefaultClassSessionDraft('Teacher Name'),
    sessionName: 'Session 1',
    recordingEnabled: true,
    monitoringSensitivity: 'medium' as const,
  };

  const baseProps = {
    name: 'test',
    roomName: '',
    teacherDisplayName: 'test [Profesor]',
    classSessionDraft: baseTeacherDraft,
    classSessionAccess: null,
    studentJoinCode: '',
    setName: () => {},
    setStudentJoinCode: () => {},
    setClassSessionDraft: () => {},
    onSelectRole: () => {},
    onCreateClassSession: () => {},
    onContinueToDeviceSelection: () => {},
  };

  it('should render correctly when there is no logged in user', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.text()).toContain('Configura la sesión docente');
    expect(wrapper.find(TextField).length).toBe(2);
  });

  it('should render correctly when there is a logged in user', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Test Name' } }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.text()).toContain('Configura la sesión docente');
    expect(wrapper.find(TextField).length).toBe(1);
  });

  it('should render correctly when there is a logged in user and "customIdentity=true" query parameter"', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Test Name' } }));

    // @ts-ignore
    delete window.location;

    // @ts-ignore
    window.location = {
      search: 'customIdentity=true',
    };

    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.text()).toContain('Configura la sesión docente');
    expect(wrapper.find(TextField).length).toBe(2);
  });

  it('blocks teacher creation without required setup and hides share info before creation', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const draft = createDefaultClassSessionDraft('Teacher Name');
    const wrapper = shallow(<RoomNameScreen {...baseProps} name="Teacher Name" classSessionDraft={draft} />);

    const createButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Crear sesión');
    expect(createButton.prop('disabled')).toBe(true);
    expect(wrapper.text()).not.toContain('Código de acceso');
    expect(wrapper.text()).not.toContain('Link para compartir');
  });

  it('shows teacher identity/share info post-create and removes legacy room intent', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        teacherDisplayName="Andres Torres [Profesor]"
        classSessionAccess={{
          roomName: 'session-1',
          joinCode: 'session-1',
          joinLink: 'https://example.org/room/session-1',
        }}
      />
    );

    expect(wrapper.text()).toContain('Identidad visible en sala');
    expect(wrapper.text()).toContain('Andres Torres [Profesor]');
    expect(wrapper.text()).toContain('Código de acceso');
    expect(wrapper.text()).toContain('Link para compartir');
    expect(wrapper.text()).not.toContain('Nombre de la sala');
    const continueButton = wrapper.findWhere(
      node => node.type() === Button && node.text() === 'Continuar a verificación'
    );
    expect(continueButton.exists()).toBe(true);
  });

  it('renders recording switch and keeps teacher creation disabled without session name', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        name="Teacher Name"
        classSessionDraft={{
          ...createDefaultClassSessionDraft('Teacher Name'),
          monitoringSensitivity: 'low',
        }}
      />
    );

    expect(wrapper.text()).toContain('¿Grabar sesión?');
    expect(wrapper.find('[data-testid="recording-toggle"]').exists()).toBe(true);
    const createButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Crear sesión');
    expect(createButton.prop('disabled')).toBe(true);
  });

  it('keeps teacher branch clean before opening student join', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.text()).toContain('Crear sesión de clase');
    expect(wrapper.text()).not.toContain('Nombre de la sala');
    expect(wrapper.text()).not.toContain('Continuar a verificación');
  });

  it('blocks student continue when required name or join code are missing', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        name=""
        classSessionDraft={{ ...baseTeacherDraft, role: 'student' }}
        studentJoinCode=""
      />
    );

    const continueButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala');
    expect(continueButton.prop('disabled')).toBe(true);
  });

  it('enables student continue when name and join code are both present', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        name="Ana"
        classSessionDraft={{ ...baseTeacherDraft, role: 'student' }}
        studentJoinCode="room-123"
      />
    );

    const continueButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala');
    expect(continueButton.prop('disabled')).toBe(false);
  });

  it('updates teacher draft fields through session switch and slider handlers', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const setClassSessionDraft = jest.fn();
    const wrapper = shallow(<RoomNameScreen {...baseProps} setClassSessionDraft={setClassSessionDraft} />);

    wrapper
      .findWhere(node => node.type() === TextField && node.prop('id') === 'input-session-name')
      .simulate('change', {
        target: { value: 'Sesión avanzada' },
      });
    wrapper.find('[data-testid="recording-toggle"]').simulate('click');
    wrapper.find('[data-testid="sensitivity-range"]').simulate('change', { target: { value: '100' } });

    expect(setClassSessionDraft).toHaveBeenCalledTimes(3);

    const sessionUpdater = setClassSessionDraft.mock.calls[0][0];
    const recordingUpdater = setClassSessionDraft.mock.calls[1][0];
    const sensitivityUpdater = setClassSessionDraft.mock.calls[2][0];

    expect(sessionUpdater(baseTeacherDraft)).toEqual({ ...baseTeacherDraft, sessionName: 'Sesión avanzada' });
    expect(recordingUpdater(baseTeacherDraft)).toEqual({ ...baseTeacherDraft, recordingEnabled: false });
    expect(sensitivityUpdater(baseTeacherDraft)).toEqual({ ...baseTeacherDraft, monitoringSensitivity: 'high' });
  });

  it('renders custom sensitivity slider structure based on wireframe layout', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.find('[data-testid="sensitivity-track"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sensitivity-range"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Baja');
    expect(wrapper.text()).toContain('Alta');
  });

  it('wires student inputs and student-only actions', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const setName = jest.fn();
    const setStudentJoinCode = jest.fn();
    const onSelectRole = jest.fn();
    const onContinueToDeviceSelection = jest.fn();
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        name="Ana"
        studentJoinCode="code-1"
        classSessionDraft={{ ...baseTeacherDraft, role: 'student' }}
        setName={setName}
        setStudentJoinCode={setStudentJoinCode}
        onSelectRole={onSelectRole}
        onContinueToDeviceSelection={onContinueToDeviceSelection}
      />
    );

    expect(wrapper.text()).toContain('Estudiante');
    expect(wrapper.text()).toContain('Unirme a sala existente');
    expect(wrapper.text()).toContain('EP01 · Flujo de acceso estudiante');
    expect(wrapper.text()).toContain('Código o enlace');
    expect(wrapper.text()).toContain('Tu nombre o alias');
    expect(wrapper.text()).toContain('Aviso de privacidad');
    expect(wrapper.text()).toContain('No se almacenan datos faciales.');
    expect(wrapper.text()).toContain('Política de privacidad →');
    expect(wrapper.find(RouterLink).prop('to')).toBe('/security');

    const joinField = wrapper.findWhere(node => node.type() === TextField && node.prop('id') === 'input-join-code');
    const nameField = wrapper.findWhere(node => node.type() === TextField && node.prop('id') === 'input-student-name');
    expect(joinField.prop('placeholder')).toBe('Ej: sala-fisica-101 o URL');
    expect(nameField.prop('placeholder')).toBe('Ej: María González');

    const continueButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala');
    expect(continueButton.prop('fullWidth')).toBe(true);

    nameField.simulate('change', {
      target: { value: 'María' },
    });
    joinField.simulate('change', {
      target: { value: 'code-2' },
    });

    wrapper.findWhere(node => node.type() === Button && node.text() === 'Volver a crear sesión').simulate('click');
    wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala').simulate('click');

    expect(setName).toHaveBeenCalledWith('María');
    expect(setStudentJoinCode).toHaveBeenCalledWith('code-2');
    expect(onSelectRole).toHaveBeenCalledWith('teacher');
    expect(onContinueToDeviceSelection).toHaveBeenCalledTimes(1);
  });

  it('handles teacher flow action buttons', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const onSelectRole = jest.fn();
    const onCreateClassSession = jest.fn();
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        onSelectRole={onSelectRole}
        onCreateClassSession={onCreateClassSession}
        classSessionDraft={{ ...baseTeacherDraft, sessionName: 'Ready Session' }}
      />
    );

    wrapper.findWhere(node => node.type() === Button && node.text() === 'Crear sesión').simulate('click');
    wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirse como estudiante').simulate('click');

    expect(onCreateClassSession).toHaveBeenCalledTimes(1);
    expect(onSelectRole).toHaveBeenCalledWith('student');
  });
});
