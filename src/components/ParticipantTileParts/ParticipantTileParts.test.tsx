import React from 'react';
import { shallow } from 'enzyme';
import PanToolIcon from '@material-ui/icons/PanTool';
import RaisedHandBadge from './RaisedHandBadge';
import ReconnectingOverlay from './ReconnectingOverlay';

describe('RaisedHandBadge', () => {
  it('announces the raised hand with its test id, title and label', () => {
    const badge = shallow(<RaisedHandBadge size="tile" />).find('[data-testid="participant-raised-hand"]');
    expect(badge.prop('title')).toBe('Mano levantada');
    expect(badge.prop('aria-label')).toBe('Mano levantada');
  });

  it('sizes the icon to the tile it sits in', () => {
    const iconSize = (size: 'tile' | 'stage') =>
      shallow(<RaisedHandBadge size={size} />)
        .find(PanToolIcon)
        .prop('style')!.fontSize;
    expect(iconSize('tile')).toBe(16);
    expect(iconSize('stage')).toBe(22);
  });

  it('uses a different badge class per size', () => {
    const className = (size: 'tile' | 'stage') => shallow(<RaisedHandBadge size={size} />).prop('className');
    expect(className('tile')).not.toBe(className('stage'));
  });
});

describe('ReconnectingOverlay', () => {
  it('tells the viewer the participant is reconnecting', () => {
    expect(
      shallow(<ReconnectingOverlay />)
        .find('WithStyles(ForwardRef(Typography))')
        .children()
        .text()
    ).toBe('Reconectando…');
  });

  it('only shrinks the message on phones for compact tiles', () => {
    const textClass = (compact?: boolean) =>
      shallow(<ReconnectingOverlay compact={compact} />)
        .find('WithStyles(ForwardRef(Typography))')
        .prop('className');
    expect(textClass(true)).not.toBe(textClass(false));
    expect(textClass(undefined)).toBe(textClass(false));
  });
});
