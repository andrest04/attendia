import React from 'react';
import { shallow } from 'enzyme';
import TileModerationMenu from './TileModerationMenu';
import OverflowMenu from '../ToolbarParts/OverflowMenu';

describe('TileModerationMenu', () => {
  it('renders the shared student moderation items inside an OverflowMenu', () => {
    const onMuteVideo = jest.fn();
    const wrapper = shallow(
      <TileModerationMenu identity="Ana" handlers={{ onMuteParticipant: jest.fn(), onMuteVideo }} />
    );
    const menu = wrapper.find(OverflowMenu);
    expect(menu.exists()).toBe(true);
    const items = menu.prop('items');
    expect(items.map(i => i.label)).toEqual(['Silenciar', 'Apagar cámara']);
    items[1].onSelect();
    expect(onMuteVideo).toHaveBeenCalledWith('Ana');
  });

  describe('on a teacher tile', () => {
    const handlers = {
      onMuteParticipant: jest.fn(),
      onMuteVideo: jest.fn(),
      onSetScreenShareGrant: jest.fn(),
    };

    it('shows the owner only the forced-off actions, never the screen-share grant', () => {
      const wrapper = shallow(
        <TileModerationMenu identity="Bea [Profesor]" handlers={{ ...handlers, actorRole: 'owner' }} />
      );
      expect(
        wrapper
          .find(OverflowMenu)
          .prop('items')
          .map(i => i.label)
      ).toEqual(['Silenciar', 'Apagar cámara']);
    });

    it('renders nothing for a co-teacher or an unknown role', () => {
      ['co-teacher', 'unknown', undefined].forEach(actorRole => {
        const wrapper = shallow(
          <TileModerationMenu identity="Bea [Profesor]" handlers={{ ...handlers, actorRole: actorRole as any }} />
        );
        expect(wrapper.isEmptyRender()).toBe(true);
      });
    });
  });

  it('renders nothing when no action is available', () => {
    expect(shallow(<TileModerationMenu identity="Ana" handlers={{}} />).isEmptyRender()).toBe(true);
  });
});
