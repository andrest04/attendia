import { createI18n } from '../../../i18n/createI18n';
import { buildModerationItemsForTarget, buildStudentModerationItems } from './studentModerationItems';

const en = createI18n({ detect: false, lng: 'en' });
const t = en.t.bind(en);

const handlers = () => ({
  onMuteParticipant: jest.fn(),
  onRequestUnmute: jest.fn(),
  onMuteVideo: jest.fn(),
  onRequestVideo: jest.fn(),
  onSetScreenShareGrant: jest.fn(),
});

describe('student moderation items in English', () => {
  it('labels every item with the given translator', () => {
    const items = buildStudentModerationItems('Ana', handlers(), 'menu', t);
    expect(items.map(item => item.label)).toEqual(['Mute', 'Turn off camera', 'Allow screen sharing']);
    const offItems = buildStudentModerationItems('Ana', handlers(), 'menu', { micOn: false, cameraOn: false }, t);
    expect(offItems.map(item => item.label)).toEqual([
      'Ask to turn on microphone',
      'Suggest camera',
      'Allow screen sharing',
    ]);
  });

  it('flips the screen-share label when the grant is active', () => {
    const items = buildStudentModerationItems('Ana', { ...handlers(), screenShareGrants: ['Ana'] }, 'menu', t);
    expect(items[items.length - 1].label).toBe('Revoke screen sharing');
  });

  it('forwards the translator through buildModerationItemsForTarget', () => {
    const items = buildModerationItemsForTarget({ identity: 'Ana', isLocal: false }, handlers(), 'menu', 'owner', t);
    expect(items[0].label).toBe('Mute');
  });

  it('defaults to Spanish for callers that do not pass a translator', () => {
    expect(buildStudentModerationItems('Ana', handlers(), 'menu')[0].label).toBe('Silenciar');
  });
});
