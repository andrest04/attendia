import { buildStudentModerationItems } from './studentModerationItems';

const fullHandlers = () => ({
  onMuteParticipant: jest.fn(),
  onRequestUnmute: jest.fn(),
  onSetScreenShareGrant: jest.fn(),
  onMuteVideo: jest.fn(),
  onRequestVideo: jest.fn(),
});

describe('buildStudentModerationItems', () => {
  it('offers every action in a stable order, with ids derived from the prefix', () => {
    const items = buildStudentModerationItems('Ana', fullHandlers(), 'menu');
    expect(items.map(i => i.testId)).toEqual([
      'menu-mute',
      'menu-request-unmute',
      'menu-mute-video',
      'menu-request-video',
      'menu-screenshare',
    ]);
    expect(items.map(i => i.label)).toEqual([
      'Silenciar',
      'Pedir activar micrófono',
      'Apagar cámara',
      'Sugerir cámara',
      'Permitir compartir pantalla',
    ]);
  });

  it('binds the identity to each handler', () => {
    const handlers = fullHandlers();
    const items = buildStudentModerationItems('Ana', handlers, 'menu');
    items.forEach(item => item.onSelect());
    expect(handlers.onMuteParticipant).toHaveBeenCalledWith('Ana');
    expect(handlers.onRequestUnmute).toHaveBeenCalledWith('Ana');
    expect(handlers.onMuteVideo).toHaveBeenCalledWith('Ana');
    expect(handlers.onRequestVideo).toHaveBeenCalledWith('Ana');
    expect(handlers.onSetScreenShareGrant).toHaveBeenCalledWith('Ana', true);
  });

  it('revokes the screen-share grant when the student already has it', () => {
    const handlers = fullHandlers();
    const items = buildStudentModerationItems('Ana', { ...handlers, screenShareGrants: ['Ana'] }, 'menu');
    const item = items.find(i => i.testId === 'menu-screenshare')!;
    expect(item.label).toBe('Quitar permiso de pantalla');
    item.onSelect();
    expect(handlers.onSetScreenShareGrant).toHaveBeenCalledWith('Ana', false);
  });

  it('drops actions whose handler is absent', () => {
    const items = buildStudentModerationItems('Ana', { onMuteVideo: jest.fn() }, 'menu');
    expect(items.map(i => i.testId)).toEqual(['menu-mute-video']);
    expect(buildStudentModerationItems('Ana', {}, 'menu')).toEqual([]);
  });
});
