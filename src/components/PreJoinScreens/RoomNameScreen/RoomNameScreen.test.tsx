import React from 'react';
import RoomNameScreen from './RoomNameScreen';
import { shallow } from 'enzyme';
import { Button, TextField } from '@material-ui/core';
import { useAppState } from '../../../state';
import { createDefaultClassSessionDraft } from '../../../classSession/classSessionTypes';
import RoleBadge from '../../RoleBadge/RoleBadge';

jest.mock('../../../state');
const mockUseAppState = useAppState as jest.Mock<any>;

describe('the RoomNameScreen component', () => {
  const baseTeacherDraft = {
    ...createDefaultClassSessionDraft('Teacher Name'),
    sessionName: 'Session 1',
    monitoringSensitivity: 'medium' as const,
  };

  const baseStudentDraft = {
    ...createDefaultClassSessionDraft(''),
    role: 'student' as const,
  };

  // Base props: teacher role by default (classSessionDraft.role = 'teacher')
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

  // ── Role-based rendering ──────────────────────────────────────────────────────

  it('renders the teacher card (only) when classSessionDraft.role is teacher', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.text()).toContain('Profesor');
    expect(wrapper.text()).toContain('Crear nueva sala de clase');
    expect(wrapper.text()).toContain('Gestión de Sala');
    expect(wrapper.text()).not.toContain('Acceso de Estudiante');
    expect(wrapper.text()).not.toContain('Unirme a sala existente');
  });

  it('renders the student card (only) when classSessionDraft.role is student', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} classSessionDraft={baseStudentDraft} />);

    expect(wrapper.text()).toContain('Estudiante');
    expect(wrapper.text()).toContain('Unirme a sala existente');
    expect(wrapper.text()).toContain('Acceso de Estudiante');
    expect(wrapper.text()).not.toContain('Gestión de Sala');
    expect(wrapper.text()).not.toContain('Crear nueva sala de clase');
  });

  // ── Role-switch link ──────────────────────────────────────────────────────────

  it('shows "Unirse como estudiante" switch link in teacher view', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.text()).toContain('Unirse como estudiante');
    expect(wrapper.text()).not.toContain('Volver a crear sesión');
  });

  it('shows "Volver a crear sesión" switch link in student view', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} classSessionDraft={baseStudentDraft} />);

    expect(wrapper.text()).toContain('Volver a crear sesión');
    expect(wrapper.text()).not.toContain('Unirse como estudiante');
  });

  it('switches from teacher to student view when the switch link is clicked', () => {
    mockUseAppState.mockImplementation(() => ({ user: { displayName: 'Teacher Name' } }));
    const onSelectRole = jest.fn();
    const wrapper = shallow(<RoomNameScreen {...baseProps} onSelectRole={onSelectRole} />);

    // Initially teacher view
    expect(wrapper.text()).toContain('Gestión de Sala');

    // Click the switch link
    wrapper.find('[data-testid="switch-to-student"]').simulate('click');

    // Now student view
    expect(wrapper.text()).toContain('Acceso de Estudiante');
    expect(wrapper.text()).not.toContain('Gestión de Sala');
    expect(onSelectRole).toHaveBeenCalledWith('student');
  });

  it('switches from student to teacher view when the switch link is clicked', () => {
    mockUseAppState.mockImplementation(() => ({ user: undefined }));
    const onSelectRole = jest.fn();
    const wrapper = shallow(
      <RoomNameScreen {...baseProps} classSessionDraft={baseStudentDraft} onSelectRole={onSelectRole} />
    );

    // Initially student view
    expect(wrapper.text()).toContain('Acceso de Estudiante');

    // Click the switch link
    wrapper.find('[data-testid="switch-to-teacher"]').simulate('click');

    // Now teacher view
    expect(wrapper.text()).toContain('Gestión de Sala');
    expect(wrapper.text()).not.toContain('Acceso de Estudiante');
    expect(onSelectRole).toHaveBeenCalledWith('teacher');
  });

  it('hides the role-switch link when a verified profile exists (teacher view)', () => {
    mockUseAppState.mockImplementationOnce(() => ({
      user: { displayName: 'Teacher Name' },
      profile: { displayName: 'Teacher Name', email: 't@example.com', role: 'teacher' },
    }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.find('[data-testid="switch-to-student"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="switch-to-teacher"]').exists()).toBe(false);
  });

  it('hides the role-switch link when a verified profile exists (student view)', () => {
    mockUseAppState.mockImplementationOnce(() => ({
      user: { displayName: 'Ana' },
      profile: { displayName: 'Ana', email: 'a@example.com', role: 'student' },
    }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} classSessionDraft={baseStudentDraft} />);

    expect(wrapper.find('[data-testid="switch-to-student"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="switch-to-teacher"]').exists()).toBe(false);
  });

  // ── Teacher card field counts ──────────────────────────────────────────────────

  it('should render correctly when there is no logged in user (teacher view)', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    // Teacher card with no user: session name + teacher name = 2
    expect(wrapper.find(TextField).length).toBe(2);
  });

  it('should render correctly when there is a logged in user (teacher view)', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Test Name' } }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    // Logged-in user: teacher card has only session name (no extra name field) = 1
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

    // customIdentity=true forces the extra teacher name field: session name + teacher name = 2
    expect(wrapper.find(TextField).length).toBe(2);
  });

  // ── Teacher card actions ───────────────────────────────────────────────────────

  it('blocks teacher creation without required setup and hides share info before creation', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const draft = createDefaultClassSessionDraft('Teacher Name');
    const wrapper = shallow(<RoomNameScreen {...baseProps} name="Teacher Name" classSessionDraft={draft} />);

    const createButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Crear sala →');
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
    // The role is a badge (same look as in the room), never the raw `[Profesor]` suffix.
    expect(wrapper.text()).toContain('Andres Torres');
    expect(wrapper.text()).not.toContain('[Profesor]');
    expect(wrapper.find(RoleBadge).exists()).toBe(true);
    expect(wrapper.text()).toContain('Nombre de la sala');
    expect(wrapper.text()).toContain('session-1');
    expect(wrapper.text()).not.toContain('Link para compartir');
    expect(wrapper.text()).not.toContain('Código de acceso');
    const continueButton = wrapper.findWhere(
      node => node.type() === Button && node.text() === 'Continuar a verificación'
    );
    expect(continueButton.exists()).toBe(true);
  });

  it('shows create button as enabled and transitions to continue on session create', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        classSessionAccess={{
          roomName: 'session-1',
          joinCode: 'session-1',
          joinLink: 'https://example.org/room/session-1',
        }}
      />
    );

    // When classSessionAccess is set, "Continuar a verificación" replaces "Crear sala →"
    const continueButton = wrapper.findWhere(
      node => node.type() === Button && node.text() === 'Continuar a verificación'
    );
    expect(continueButton.exists()).toBe(true);
    expect(wrapper.findWhere(node => node.type() === Button && node.text() === 'Crear sala →').exists()).toBe(false);
  });

  it('copies the room name from the created session card and does not show a link', () => {
    // mockImplementation (not Once): clicking copy re-renders, so useAppState is called again.
    mockUseAppState.mockImplementation(() => ({ user: { displayName: 'Teacher Name' } }));
    const writeText = jest.fn();
    Object.assign(navigator, { clipboard: { writeText } });
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

    expect(wrapper.text()).not.toContain('https://example.org/room/session-1');

    const copyButtons = wrapper.findWhere(node => node.type() === Button && node.text() === 'Copiar');
    expect(copyButtons.length).toBe(1);

    copyButtons.at(0).simulate('click');
    expect(writeText).toHaveBeenCalledWith('session-1');
  });

  it('shows no role badge in the created card when the visible name carries no teacher suffix', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        teacherDisplayName="Andres Torres"
        classSessionAccess={{
          roomName: 'session-1',
          joinCode: 'session-1',
          joinLink: 'https://example.org/room/session-1',
        }}
      />
    );

    expect(wrapper.text()).toContain('Andres Torres');
    expect(wrapper.find(RoleBadge).exists()).toBe(false);
  });

  it('keeps teacher creation disabled without session name', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        name="Teacher Name"
        classSessionDraft={createDefaultClassSessionDraft('Teacher Name')}
      />
    );

    const createButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Crear sala →');
    expect(createButton.prop('disabled')).toBe(true);
  });

  it('updates the teacher session name through its handler', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const setClassSessionDraft = jest.fn();
    const wrapper = shallow(<RoomNameScreen {...baseProps} setClassSessionDraft={setClassSessionDraft} />);

    wrapper
      .findWhere(node => node.type() === TextField && node.prop('id') === 'input-session-name')
      .simulate('change', {
        target: { value: 'Sesión avanzada' },
      });

    expect(setClassSessionDraft).toHaveBeenCalledTimes(1);

    const sessionUpdater = setClassSessionDraft.mock.calls[0][0];
    expect(sessionUpdater(baseTeacherDraft)).toEqual({ ...baseTeacherDraft, sessionName: 'Sesión avanzada' });
  });

  it('does not render the recording toggle or the proctoring sensitivity slider', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    expect(wrapper.find('[data-testid="recording-toggle"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Habilitar grabación');
    expect(wrapper.find('[data-testid="sensitivity-track"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="sensitivity-range"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Sensibilidad de proctoring');
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

    wrapper
      .findWhere(node => node.type() === Button && node.text() === 'Crear sala →')
      .first()
      .simulate('click');

    expect(onCreateClassSession).toHaveBeenCalledTimes(1);
  });

  // ── Teacher joins an existing room ─────────────────────────────────────────────

  describe('the teacher join-by-code box', () => {
    const joinProps = {
      ...baseProps,
      teacherJoinCode: '',
      setTeacherJoinCode: () => {},
      onJoinExistingRoom: () => {},
    };
    const findJoinButton = (wrapper: any) =>
      wrapper.findWhere((node: any) => node.type() === Button && /Entrar a la sala/.test(node.text())).first();

    beforeEach(() => {
      mockUseAppState.mockImplementation(() => ({ user: { displayName: 'Teacher Name' } }));
    });
    afterEach(() => {
      mockUseAppState.mockReset();
    });

    it('is offered in the teacher card as a secondary option', () => {
      const wrapper = shallow(<RoomNameScreen {...joinProps} />);

      expect(wrapper.text()).toContain('¿Ya hay una sala abierta?');
      expect(wrapper.find('#input-teacher-join-code').exists()).toBe(true);
      expect(findJoinButton(wrapper).prop('type')).toBe('button');
    });

    it('is not rendered when the host provides no join handler', () => {
      const wrapper = shallow(<RoomNameScreen {...baseProps} />);

      expect(wrapper.find('#input-teacher-join-code').exists()).toBe(false);
      expect(wrapper.text()).not.toContain('¿Ya hay una sala abierta?');
    });

    it('is not rendered in the student card', () => {
      const wrapper = shallow(<RoomNameScreen {...joinProps} classSessionDraft={baseStudentDraft} />);

      expect(wrapper.find('#input-teacher-join-code').exists()).toBe(false);
    });

    it('forwards the typed code and calls the join handler', () => {
      const setTeacherJoinCode = jest.fn();
      const onJoinExistingRoom = jest.fn();
      const wrapper = shallow(
        <RoomNameScreen
          {...joinProps}
          teacherJoinCode="aula-7"
          setTeacherJoinCode={setTeacherJoinCode}
          onJoinExistingRoom={onJoinExistingRoom}
        />
      );

      wrapper.find('#input-teacher-join-code').simulate('change', { target: { value: 'aula-8' } });
      findJoinButton(wrapper).simulate('click');

      expect(setTeacherJoinCode).toHaveBeenCalledWith('aula-8');
      expect(onJoinExistingRoom).toHaveBeenCalledTimes(1);
    });

    it('joins on Enter in the code field without submitting the create form', () => {
      const onJoinExistingRoom = jest.fn();
      const preventDefault = jest.fn();
      const wrapper = shallow(
        <RoomNameScreen {...joinProps} teacherJoinCode="aula-7" onJoinExistingRoom={onJoinExistingRoom} />
      );

      wrapper.find('#input-teacher-join-code').simulate('keyDown', { key: 'Enter', preventDefault });

      expect(preventDefault).toHaveBeenCalled();
      expect(onJoinExistingRoom).toHaveBeenCalledTimes(1);
    });

    it('is disabled without a code or without the teacher name', () => {
      expect(findJoinButton(shallow(<RoomNameScreen {...joinProps} teacherJoinCode="" />)).prop('disabled')).toBe(true);
      expect(
        findJoinButton(shallow(<RoomNameScreen {...joinProps} teacherJoinCode="aula-7" name="  " />)).prop('disabled')
      ).toBe(true);
      expect(findJoinButton(shallow(<RoomNameScreen {...joinProps} teacherJoinCode="aula-7" />)).prop('disabled')).toBe(
        false
      );
    });

    it('shows a checking state and disables the button while the room is verified', () => {
      const wrapper = shallow(<RoomNameScreen {...joinProps} teacherJoinCode="aula-7" teacherJoinStatus="checking" />);

      const button = wrapper.findWhere((node: any) => node.type() === Button && node.text() === 'Verificando sala…');
      expect(button.exists()).toBe(true);
      expect(button.prop('disabled')).toBe(true);
    });
  });

  describe('when the room being created is already open', () => {
    beforeEach(() => {
      mockUseAppState.mockImplementation(() => ({ user: { displayName: 'Teacher Name' } }));
    });
    afterEach(() => {
      mockUseAppState.mockReset();
    });

    it('steers the teacher to join it instead of creating', () => {
      const onJoinOpenRoom = jest.fn();
      const wrapper = shallow(<RoomNameScreen {...baseProps} openRoomName="clase-1" onJoinOpenRoom={onJoinOpenRoom} />);

      const notice = wrapper.find('[data-testid="open-room-notice"]');
      expect(notice.prop('role')).toBe('alert');
      expect(notice.html()).toContain('Esa sala ya está abierta');
      expect(notice.html()).toContain('clase-1');

      wrapper
        .findWhere(node => node.type() === Button && node.text() === 'Sí, entrar a la sala')
        .first()
        .simulate('click');
      expect(onJoinOpenRoom).toHaveBeenCalledTimes(1);
    });

    it('shows no notice by default', () => {
      const wrapper = shallow(<RoomNameScreen {...baseProps} />);

      expect(wrapper.find('[data-testid="open-room-notice"]').exists()).toBe(false);
    });
  });

  describe('when the room to join is not open', () => {
    const closedProps = {
      ...baseProps,
      teacherJoinCode: 'https://x.org/room/Aula-7',
      teacherJoinStatus: 'closed' as const,
      setTeacherJoinCode: () => {},
      onJoinExistingRoom: () => {},
    };
    const findByText = (wrapper: any, text: string) =>
      wrapper.findWhere((node: any) => node.type() === Button && node.text() === text).first();

    beforeEach(() => {
      mockUseAppState.mockImplementation(() => ({ user: { displayName: 'Teacher Name' } }));
    });
    afterEach(() => {
      mockUseAppState.mockReset();
    });

    it('shows a clear message and the create-with-this-name action', () => {
      const wrapper = shallow(<RoomNameScreen {...closedProps} onCreateWithJoinName={() => {}} />);

      const alert = wrapper.find('[data-testid="teacher-join-closed"]');
      expect(alert.prop('role')).toBe('alert');
      expect(alert.html()).toContain('aula-7');
      expect(alert.html()).toContain('no está abierta');
      expect(findByText(wrapper, 'Crear con este nombre').exists()).toBe(true);
    });

    it('asks for confirmation before creating and creates only after confirming', () => {
      const onCreateWithJoinName = jest.fn();
      const wrapper = shallow(<RoomNameScreen {...closedProps} onCreateWithJoinName={onCreateWithJoinName} />);

      findByText(wrapper, 'Crear con este nombre').simulate('click');

      expect(onCreateWithJoinName).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="teacher-join-confirm"]').html()).toContain('aula-7');

      findByText(wrapper, 'Sí, crear sala').simulate('click');

      expect(onCreateWithJoinName).toHaveBeenCalledTimes(1);
    });

    it('goes back from the confirmation without creating', () => {
      const onCreateWithJoinName = jest.fn();
      const wrapper = shallow(<RoomNameScreen {...closedProps} onCreateWithJoinName={onCreateWithJoinName} />);

      findByText(wrapper, 'Crear con este nombre').simulate('click');
      findByText(wrapper, 'Cancelar').simulate('click');

      expect(wrapper.find('[data-testid="teacher-join-confirm"]').exists()).toBe(false);
      expect(findByText(wrapper, 'Crear con este nombre').exists()).toBe(true);
      expect(onCreateWithJoinName).not.toHaveBeenCalled();
    });

    it('shows a retryable error and no create action when the probe was inconclusive', () => {
      const wrapper = shallow(<RoomNameScreen {...closedProps} teacherJoinStatus="inconclusive" />);

      const alert = wrapper.find('[data-testid="teacher-join-inconclusive"]');
      expect(alert.prop('role')).toBe('alert');
      expect(alert.html()).toContain('No pudimos verificar');
      expect(findByText(wrapper, 'Crear con este nombre').exists()).toBe(false);
      expect(findByText(wrapper, 'Entrar a la sala').prop('disabled')).toBe(false);
    });

    it('shows neither message while idle', () => {
      const wrapper = shallow(<RoomNameScreen {...closedProps} teacherJoinStatus="idle" />);

      expect(wrapper.find('[data-testid="teacher-join-closed"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="teacher-join-inconclusive"]').exists()).toBe(false);
    });
  });

  // ── Student card actions ───────────────────────────────────────────────────────

  it('blocks student continue when required name or join code are missing', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(
      <RoomNameScreen {...baseProps} name="" classSessionDraft={baseStudentDraft} studentJoinCode="" />
    );

    const continueButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala →');
    expect(continueButton.prop('disabled')).toBe(true);
  });

  it('enables student continue when name and join code are both present', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(
      <RoomNameScreen {...baseProps} name="Ana" classSessionDraft={baseStudentDraft} studentJoinCode="room-123" />
    );

    const continueButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala →');
    expect(continueButton.prop('disabled')).toBe(false);
  });

  it('does not show the room-closed alert by default in the student flow', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(
      <RoomNameScreen {...baseProps} name="Ana" studentJoinCode="room-123" classSessionDraft={baseStudentDraft} />
    );

    expect(wrapper.text()).not.toContain('La sala todavía no está abierta');
  });

  it('shows the room-closed alert when roomClosedError is set', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        name="Ana"
        studentJoinCode="room-123"
        classSessionDraft={baseStudentDraft}
        roomClosedError
      />
    );

    expect(wrapper.text()).toContain('La sala todavía no está abierta');
  });

  it('shows a checking state and disables the join button while verifying the room', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        name="Ana"
        studentJoinCode="room-123"
        classSessionDraft={baseStudentDraft}
        isCheckingRoom
      />
    );

    const joinButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Verificando sala…');
    expect(joinButton.exists()).toBe(true);
    expect(joinButton.prop('disabled')).toBe(true);
  });

  it('shows a creating state and disables the create button while resolving a collision-safe room name', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        classSessionDraft={{ ...baseTeacherDraft, sessionName: 'Ready Session' }}
        isCreatingRoom
      />
    );

    const createButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Creando sala…');
    expect(createButton.exists()).toBe(true);
    expect(createButton.prop('disabled')).toBe(true);
  });

  // ── Keyboard submit (Enter) ─────────────────────────────────────────────────────

  it('wraps the teacher card in a form whose primary action is a submit button (Enter creates)', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(
      <RoomNameScreen {...baseProps} classSessionDraft={{ ...baseTeacherDraft, sessionName: 'Ready Session' }} />
    );

    expect(wrapper.find('form').exists()).toBe(true);
    const createButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Crear sala →');
    expect(createButton.prop('type')).toBe('submit');
  });

  it('prevents the native page reload when the teacher form is submitted', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(<RoomNameScreen {...baseProps} />);

    const preventDefault = jest.fn();
    wrapper.find('form').simulate('submit', { preventDefault });
    expect(preventDefault).toHaveBeenCalled();
  });

  it('makes the student "Unirme a la sala →" a submit button so Enter joins', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const wrapper = shallow(
      <RoomNameScreen {...baseProps} name="Ana" studentJoinCode="room-1" classSessionDraft={baseStudentDraft} />
    );

    expect(wrapper.find('form').exists()).toBe(true);
    const joinButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala →');
    expect(joinButton.prop('type')).toBe('submit');
  });

  it('keeps the teacher "Copiar" button as type="button" so it never hijacks Enter', () => {
    mockUseAppState.mockImplementation(() => ({ user: { displayName: 'Teacher Name' } }));
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        classSessionAccess={{
          roomName: 'session-1',
          joinCode: 'session-1',
          joinLink: 'https://example.org/room/session-1',
        }}
      />
    );

    const copyButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Copiar');
    expect(copyButton.prop('type')).toBe('button');
  });

  it('wires student inputs and student-only actions', () => {
    mockUseAppState.mockImplementationOnce(() => ({ user: undefined }));
    const setName = jest.fn();
    const setStudentJoinCode = jest.fn();
    const onSelectRole = jest.fn();
    const onContinueAsStudent = jest.fn();
    const wrapper = shallow(
      <RoomNameScreen
        {...baseProps}
        name="Ana"
        studentJoinCode="code-1"
        classSessionDraft={baseStudentDraft}
        setName={setName}
        setStudentJoinCode={setStudentJoinCode}
        onSelectRole={onSelectRole}
        onContinueAsStudent={onContinueAsStudent}
      />
    );

    expect(wrapper.text()).toContain('Estudiante');
    expect(wrapper.text()).toContain('Unirme a sala existente');
    expect(wrapper.text()).toContain('Acceso de Estudiante');
    expect(wrapper.text()).toContain('Código o enlace de sala');
    expect(wrapper.text()).toContain('Tu nombre o alias');
    expect(wrapper.text()).toContain('Te unirás con tu cuenta.');
    expect(wrapper.text()).not.toContain('No requiere crear una cuenta');
    expect(wrapper.text()).toContain('Aviso de privacidad');
    expect(wrapper.text()).toContain('No se almacenan datos faciales.');

    const joinField = wrapper.findWhere(node => node.type() === TextField && node.prop('id') === 'input-join-code');
    const nameField = wrapper.findWhere(node => node.type() === TextField && node.prop('id') === 'input-student-name');
    expect(joinField.prop('placeholder')).toBe('Ingresar código de sesión');
    expect(nameField.prop('placeholder')).toBe('Ej: Ana García');

    const continueButton = wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala →');
    expect(continueButton.prop('fullWidth')).toBe(true);

    nameField.simulate('change', {
      target: { value: 'María' },
    });
    joinField.simulate('change', {
      target: { value: 'code-2' },
    });

    // Clicking join calls the dedicated onContinueAsStudent handler
    wrapper.findWhere(node => node.type() === Button && node.text() === 'Unirme a la sala →').simulate('click');

    expect(setName).toHaveBeenCalledWith('María');
    expect(setStudentJoinCode).toHaveBeenCalledWith('code-2');
    expect(onContinueAsStudent).toHaveBeenCalledTimes(1);
    // onSelectRole is not called directly by the student button when onContinueAsStudent is provided
    expect(onSelectRole).not.toHaveBeenCalled();
  });
});
