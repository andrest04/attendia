import React from 'react';
import { mount } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import { createDefaultClassSessionDraft } from '../../classSession/classSessionTypes';
import { useAppState } from '../../state';
import RoomNameScreen from './RoomNameScreen/RoomNameScreen';
import AttentionConsentModal from './AttentionConsentModal';
import { getSnackbarContent } from './MediaErrorSnackbar/MediaErrorSnackbar';
import enhanceMessage from '../ErrorDialog/enhanceMessage';

jest.mock('../../state');
const mockUseAppState = useAppState as jest.Mock<any>;

const english = createI18n({ detect: false, lng: 'en' });
const spanish = createI18n({ detect: false, lng: 'es' });

const baseProps = {
  name: 'test',
  roomName: '',
  teacherDisplayName: 'test [Profesor]',
  classSessionDraft: { ...createDefaultClassSessionDraft('Teacher Name'), sessionName: 'Session 1' },
  classSessionAccess: null,
  studentJoinCode: '',
  setName: () => {},
  setStudentJoinCode: () => {},
  setClassSessionDraft: () => {},
  onSelectRole: () => {},
  onCreateClassSession: () => {},
  onContinueToDeviceSelection: () => {},
};

describe('prejoin copy in English', () => {
  let wrapper: ReturnType<typeof mount> | undefined;
  beforeEach(() => {
    mockUseAppState.mockImplementation(() => ({ user: undefined, profile: undefined }));
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('translates the teacher card, the open-room notice and the join box', () => {
    wrapper = mount(
      <I18nextProvider i18n={english}>
        <RoomNameScreen
          {...baseProps}
          openRoomName="algebra"
          onJoinOpenRoom={() => {}}
          onJoinExistingRoom={() => {}}
          teacherJoinStatus="closed"
          teacherJoinCode="Algebra 2"
          onCreateWithJoinName={() => {}}
        />
      </I18nextProvider>
    );
    const text = wrapper.text();
    expect(text).toContain('Create a new class room');
    expect(text).toContain('Room management');
    expect(text).toContain('Join as a student');
    expect(
      wrapper
        .find('[data-testid="open-room-notice"]')
        .hostNodes()
        .text()
    ).toContain('That room is already open (algebra). Do you want to enter?');
    expect(wrapper.find('[data-testid="open-room-notice"] strong').text()).toBe('algebra');
    expect(text).toContain('Is there already an open room?');
    expect(
      wrapper
        .find('[data-testid="teacher-join-closed"]')
        .hostNodes()
        .text()
    ).toContain('is not open');
    expect(text).not.toContain('Crear');
  });

  it('translates the student card', () => {
    wrapper = mount(
      <I18nextProvider i18n={english}>
        <RoomNameScreen
          {...baseProps}
          classSessionDraft={{ ...baseProps.classSessionDraft, role: 'student' }}
          roomClosedError
        />
      </I18nextProvider>
    );
    const text = wrapper.text();
    expect(text).toContain('Join an existing room');
    expect(text).toContain('By joining you accept local image processing');
    expect(wrapper.find('strong').text()).toBe('local');
    expect(text).toContain('The room is not open yet.');
    expect(text).toContain('Join the room →');
  });

  it('translates the consent modal', () => {
    wrapper = mount(
      <I18nextProvider i18n={english}>
        <AttentionConsentModal open onAccept={() => {}} onDecline={() => {}} />
      </I18nextProvider>
    );
    // MUI renders the dialog through a portal, so read the document instead of the wrapper tree.
    const text = document.body.textContent || '';
    expect(text).toContain('Attention analysis in class');
    expect(text).toContain('All processing happens on your device (on-device)');
    expect(text).toContain('Accept and join');
  });

  it('returns media error copy in the language of the translator it is given', () => {
    const error = Object.assign(new Error('x'), { name: 'NotFoundError' });
    expect(getSnackbarContent(true, true, error, english.t).headline).toBe('No microphone or camera found:');
    expect(getSnackbarContent(true, true, error, spanish.t).headline).toBe('No se encontró micrófono ni cámara:');
    expect(getSnackbarContent(true, false, undefined, english.t)).toEqual({
      headline: 'No camera detected:',
      message: 'The other participants will not be able to see you.',
    });
  });

  it('enhances device errors in English when given the English translator', () => {
    expect(enhanceMessage('', undefined, 'NotFoundError', english.t)).toBe(
      'No camera or microphone was found. Connect a device and try again.'
    );
    expect(enhanceMessage('', 20101, undefined, english.t)).toContain('could not be validated');
  });
});
