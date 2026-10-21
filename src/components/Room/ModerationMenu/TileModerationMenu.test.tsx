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

  it('renders nothing when no action is available', () => {
    expect(shallow(<TileModerationMenu identity="Ana" handlers={{}} />).isEmptyRender()).toBe(true);
  });
});
