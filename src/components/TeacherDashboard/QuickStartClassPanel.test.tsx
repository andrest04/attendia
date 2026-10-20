import React from 'react';
import { act } from 'react-dom/test-utils';
import { shallow } from 'enzyme';
import QuickStartClassPanel from './QuickStartClassPanel';
import RoomNameScreen from '../PreJoinScreens/RoomNameScreen/RoomNameScreen';

describe('QuickStartClassPanel', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('reuses the same RoomNameScreen teacher card the standalone prejoin lobby uses', () => {
    const wrapper = shallow(
      <QuickStartClassPanel professorName="Andrés Torres" onCreate={jest.fn()} onJoinOpen={jest.fn()} />
    );

    expect(wrapper.find(RoomNameScreen).exists()).toBe(true);
    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('teacher');
  });

  it('only calls onCreate with the resolved room/name after create + continue', async () => {
    // No collision: the collision-safe probe reports the room is not open, so the clean slug is kept.
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ open: false }) }) as any;

    const onCreate = jest.fn();
    const wrapper = shallow(
      <QuickStartClassPanel professorName="Andrés Torres" onCreate={onCreate} onJoinOpen={jest.fn()} />
    );

    // Type the session name, same way the field's onChange would.
    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')(draft => ({
      ...draft,
      sessionName: 'Matemáticas — Grupo A',
    }));
    wrapper.update();

    // "Crear sala" — creates the access but must not navigate yet.
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    });
    wrapper.update();
    expect(onCreate).not.toHaveBeenCalled();
    expect(wrapper.find(RoomNameScreen).prop('classSessionAccess')).toEqual({
      roomName: 'matematicas-grupo-a',
      joinCode: 'matematicas-grupo-a',
      joinLink: expect.stringContaining('/room/matematicas-grupo-a'),
    });

    // "Continuar a verificación" — only now the real navigation fires.
    wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();

    expect(onCreate).toHaveBeenCalledWith({
      roomName: 'matematicas-grupo-a',
      name: 'Andrés Torres [Profesor]',
      title: 'Matemáticas — Grupo A',
    });
  });

  it('offers to join an open room instead of creating a suffixed one', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ open: true }) }) as any;

    const onCreate = jest.fn();
    const onJoinOpen = jest.fn();
    const wrapper = shallow(
      <QuickStartClassPanel professorName="Andrés Torres" onCreate={onCreate} onJoinOpen={onJoinOpen} />
    );
    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')(draft => ({ ...draft, sessionName: 'Matemáticas' }));
    wrapper.update();

    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    });
    wrapper.update();

    expect(wrapper.find(RoomNameScreen).prop('classSessionAccess')).toBeNull();
    expect(wrapper.find(RoomNameScreen).prop('openRoomName')).toBe('matematicas');

    wrapper.find(RoomNameScreen).prop('onJoinOpenRoom')!();
    expect(onCreate).not.toHaveBeenCalled();
    expect(onJoinOpen).toHaveBeenCalledWith({
      roomName: 'matematicas',
      name: 'Andrés Torres [Profesor]',
      title: 'Matemáticas',
    });
  });
});
