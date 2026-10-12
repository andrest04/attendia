import React from 'react';
import { mount } from 'enzyme';
import { ThemeProvider } from '@material-ui/core/styles';
import theme from '../../../theme';
import RoomShellLayout, { RoomShellVariant } from './RoomShellLayout';
import { CollapsibleRail, RailCloseButton } from './CollapsibleRail';

const renderLayout = (props: { variant?: RoomShellVariant; leftOpen?: boolean; rightOpen?: boolean } = {}) =>
  mount(
    <ThemeProvider theme={theme}>
      <RoomShellLayout
        variant={props.variant ?? 'professor'}
        testIdPrefix="shell"
        statusBar={<header data-testid="bar" />}
        leftRail={<aside data-testid="left" />}
        center={<main data-testid="center" />}
        rightRail={<aside data-testid="right" />}
        toolbar={<nav data-testid="toolbar" />}
        leftOpen={props.leftOpen ?? false}
        rightOpen={props.rightOpen ?? false}
      >
        <div data-testid="extra" />
      </RoomShellLayout>
    </ThemeProvider>
  );

describe('RoomShellLayout', () => {
  it('fills every slot and exposes the root and footer test ids', () => {
    const wrapper = renderLayout();
    ['shell-root', 'bar', 'left', 'center', 'right', 'shell-toolbar-slot', 'toolbar', 'extra'].forEach(id =>
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true)
    );
  });

  it('places the toolbar inside the footer slot, after the body', () => {
    const wrapper = renderLayout();
    expect(wrapper.find('[data-testid="shell-toolbar-slot"] [data-testid="toolbar"]').exists()).toBe(true);
    const root = wrapper.find('section[data-testid="shell-root"]').getDOMNode();
    const order = Array.from(root.children).map(child => child.tagName);
    expect(order).toEqual(['HEADER', 'DIV', 'DIV', 'DIV']);
  });

  it('gives each combination of open rails its own column template', () => {
    const bodyClass = (open: { leftOpen: boolean; rightOpen: boolean }) =>
      renderLayout(open)
        .find('section[data-testid="shell-root"] > div')
        .at(0)
        .prop('className');

    const classes = [
      bodyClass({ leftOpen: true, rightOpen: true }),
      bodyClass({ leftOpen: true, rightOpen: false }),
      bodyClass({ leftOpen: false, rightOpen: true }),
      bodyClass({ leftOpen: false, rightOpen: false }),
    ];
    expect(new Set(classes).size).toBe(4);
  });

  it('uses a different set of column templates per shell variant', () => {
    const bodyClass = (variant: RoomShellVariant) =>
      renderLayout({ variant, leftOpen: true, rightOpen: true })
        .find('section[data-testid="shell-root"] > div')
        .at(0)
        .prop('className');
    expect(bodyClass('professor')).not.toBe(bodyClass('student'));
  });
});

describe('CollapsibleRail', () => {
  const renderRail = (open: boolean, side: 'left' | 'right' = 'left') =>
    mount(
      <CollapsibleRail side={side} open={open} className="own" data-testid="rail">
        <span>content</span>
      </CollapsibleRail>
    );

  it('keeps its content mounted while closed and hides it from assistive tech', () => {
    const closed = renderRail(false);
    expect(closed.find('aside').prop('aria-hidden')).toBe(true);
    expect(closed.text()).toBe('content');
    expect(
      renderRail(true)
        .find('aside')
        .prop('aria-hidden')
    ).toBe(false);
  });

  it('marks only a closed rail as collapsed and keeps the caller class', () => {
    const closed = renderRail(false)
      .find('aside')
      .prop('className') as string;
    const open = renderRail(true)
      .find('aside')
      .prop('className') as string;
    expect(closed).toContain('own');
    expect(open).toContain('own');
    expect(closed.split(' ').length).toBe(open.split(' ').length + 1);
  });

  it('puts the seam border on the side that faces the stage', () => {
    const left = renderRail(true, 'left')
      .find('aside')
      .prop('className');
    const right = renderRail(true, 'right')
      .find('aside')
      .prop('className');
    expect(left).not.toBe(right);
  });
});

describe('RailCloseButton', () => {
  it('renders an accessible × button that calls onClick', () => {
    const onClick = jest.fn();
    const wrapper = mount(<RailCloseButton onClick={onClick} aria-label="Cerrar" data-testid="close" />);
    const button = wrapper.find('button');
    expect(button.prop('type')).toBe('button');
    expect(button.prop('aria-label')).toBe('Cerrar');
    expect(button.text()).toBe('×');
    button.simulate('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
