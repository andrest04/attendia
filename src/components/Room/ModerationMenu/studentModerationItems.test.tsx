import { buildModerationItemsForTarget, buildStudentModerationItems } from './studentModerationItems';

const fullHandlers = () => ({
  onMuteParticipant: jest.fn(),
  onRequestUnmute: jest.fn(),
  onSetScreenShareGrant: jest.fn(),
  onMuteVideo: jest.fn(),
  onRequestVideo: jest.fn(),
});

describe('buildStudentModerationItems', () => {
  it('offers only the action that fits each device state', () => {
    const labels = (media: { micOn: boolean; cameraOn: boolean }) =>
      buildStudentModerationItems('Ana', fullHandlers(), 'menu', media)
        .filter(i => i.testId !== 'menu-screenshare')
        .map(i => i.label);
    expect(labels({ micOn: true, cameraOn: true })).toEqual(['Silenciar', 'Apagar cámara']);
    expect(labels({ micOn: false, cameraOn: false })).toEqual(['Pedir activar micrófono', 'Sugerir cámara']);
    expect(labels({ micOn: true, cameraOn: false })).toEqual(['Silenciar', 'Sugerir cámara']);
  });

  it('offers every action in a stable order, with ids derived from the prefix', () => {
    const items = buildStudentModerationItems('Ana', fullHandlers(), 'menu');
    expect(items.map(i => i.testId)).toEqual(['menu-mute', 'menu-mute-video', 'menu-screenshare']);
    expect(items.map(i => i.label)).toEqual(['Silenciar', 'Apagar cámara', 'Permitir compartir pantalla']);
  });

  it('binds the identity to each handler', () => {
    const handlers = fullHandlers();
    [
      ...buildStudentModerationItems('Ana', handlers, 'menu', { micOn: true, cameraOn: true }),
      ...buildStudentModerationItems('Ana', handlers, 'menu', { micOn: false, cameraOn: false }),
    ].forEach(item => item.onSelect());
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

describe('buildModerationItemsForTarget', () => {
  const ids = (items: Array<{ testId?: string }>) => items.map(i => i.testId);

  it('offers students the full menu to an owner and to a co-teacher', () => {
    const target = { identity: 'Ana', isLocal: false };
    expect(buildModerationItemsForTarget(target, fullHandlers(), 'menu', 'owner')).toHaveLength(3);
    expect(buildModerationItemsForTarget(target, fullHandlers(), 'menu', 'co-teacher')).toHaveLength(3);
  });

  it('offers a teacher target only forced-off actions and suggestions (no screen-share grant) to the owner', () => {
    const items = buildModerationItemsForTarget(
      { identity: 'Bea [Profesor]', isLocal: false },
      fullHandlers(),
      'menu',
      'owner'
    );
    expect(ids(items)).toEqual(['menu-mute', 'menu-mute-video']);
  });

  it('reads the actor role from the handlers when none is passed', () => {
    const handlers = { ...fullHandlers(), actorRole: 'owner' as const };
    expect(
      buildModerationItemsForTarget({ identity: 'Bea [Profesor]', isLocal: false }, handlers, 'menu')
    ).toHaveLength(2);
  });

  it('offers nothing on a teacher to a co-teacher, an unknown role or when the target is oneself', () => {
    const teacher = { identity: 'Bea [Profesor]', isLocal: false };
    expect(buildModerationItemsForTarget(teacher, fullHandlers(), 'menu', 'co-teacher')).toEqual([]);
    expect(buildModerationItemsForTarget(teacher, fullHandlers(), 'menu', 'unknown')).toEqual([]);
    expect(buildModerationItemsForTarget(teacher, fullHandlers(), 'menu')).toEqual([]);
    expect(
      buildModerationItemsForTarget({ identity: 'Bea [Profesor]', isLocal: true }, fullHandlers(), 'menu', 'owner')
    ).toEqual([]);
  });
});
