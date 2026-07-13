import React from 'react';
import { shallow } from 'enzyme';
import QuickStartClassPanel from './QuickStartClassPanel';
import RoomNameScreen from '../PreJoinScreens/RoomNameScreen/RoomNameScreen';

describe('QuickStartClassPanel', () => {
  it('reuses the same RoomNameScreen teacher card the standalone prejoin lobby uses', () => {
    const wrapper = shallow(<QuickStartClassPanel professorName="Andrés Torres" onCreate={jest.fn()} />);

    expect(wrapper.find(RoomNameScreen).exists()).toBe(true);
    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('teacher');
  });

  it('only calls onCreate with the resolved room/name after create + continue', () => {
    const onCreate = jest.fn();
    const wrapper = shallow(<QuickStartClassPanel professorName="Andrés Torres" onCreate={onCreate} />);

    // Type the session name, same way the field's onChange would.
    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')(draft => ({ ...draft, sessionName: 'Matemáticas — Grupo A' }));
    wrapper.update();

    // "Crear sala" — creates the access but must not navigate yet.
    wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
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
    });
  });
});
