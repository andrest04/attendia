import React from 'react';
import { shallow } from 'enzyme';
import OverflowMenu, { OverflowMenuItem } from './OverflowMenu';

const item = (overrides: Partial<OverflowMenuItem> = {}): OverflowMenuItem => ({
  testId: 'item-a',
  label: 'Item A',
  icon: <span>a</span>,
  onSelect: jest.fn(),
  ...overrides,
});

const render = (items: OverflowMenuItem[]) =>
  shallow(<OverflowMenu items={items} testIdPrefix="toolbar" chipClassName="chip" />);

const open = (wrapper: ReturnType<typeof render>) => wrapper.find('[data-testid="toolbar-more"]').simulate('click');

describe('OverflowMenu', () => {
  it('renders only the kebab until it is opened', () => {
    const wrapper = render([item()]);
    const kebab = wrapper.find('[data-testid="toolbar-more"]');
    expect(kebab.prop('className')).toBe('chip');
    expect(kebab.prop('aria-expanded')).toBe(false);
    expect(wrapper.find('[data-testid="toolbar-more-menu"]').exists()).toBe(false);
  });

  it('opens and closes the menu from the kebab', () => {
    const wrapper = render([item()]);
    open(wrapper);
    expect(wrapper.find('[data-testid="toolbar-more-menu"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="toolbar-more"]').prop('aria-expanded')).toBe(true);

    open(wrapper);
    expect(wrapper.find('[data-testid="toolbar-more-menu"]').exists()).toBe(false);
  });

  it('closes the menu when the backdrop is clicked', () => {
    const wrapper = render([item()]);
    open(wrapper);
    // The backdrop is the only plain div that handles clicks.
    wrapper
      .find('div')
      .filterWhere(div => typeof div.prop('onClick') === 'function')
      .simulate('click');
    expect(wrapper.find('[data-testid="toolbar-more-menu"]').exists()).toBe(false);
  });

  it('runs the selected item and then closes the menu', () => {
    const onSelect = jest.fn();
    const wrapper = render([item({ onSelect })]);
    open(wrapper);

    wrapper.find('[data-testid="item-a"]').simulate('click');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="toolbar-more-menu"]').exists()).toBe(false);
  });

  it('renders the label and exposes checked and disabled state', () => {
    const wrapper = render([item({ checked: true, disabled: true })]);
    open(wrapper);
    const button = wrapper.find('[data-testid="item-a"]');
    expect(button.text()).toContain('Item A');
    expect(button.prop('role')).toBe('menuitemcheckbox');
    expect(button.prop('aria-checked')).toBe(true);
    expect(button.prop('disabled')).toBe(true);
  });

  it('reports an unchecked item as aria-checked=false', () => {
    const wrapper = render([item()]);
    open(wrapper);
    expect(wrapper.find('[data-testid="item-a"]').prop('aria-checked')).toBe(false);
  });

  it('drops hidden items and separates the visible ones with a single divider each', () => {
    const wrapper = render([
      item({ testId: 'first' }),
      item({ testId: 'skipped', hidden: true }),
      item({ testId: 'second' }),
      item({ testId: 'third' }),
    ]);
    open(wrapper);

    expect(wrapper.find('[data-testid="skipped"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="first"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="second"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="third"]').exists()).toBe(true);
    // 3 visible items → 2 dividers (nothing before the first, nothing doubled by the hidden one).
    const menu = wrapper.find('[data-testid="toolbar-more-menu"]');
    expect(menu.children()).toHaveLength(5);
  });

  it('still opens an empty menu when every item is hidden', () => {
    const wrapper = render([item({ hidden: true })]);
    open(wrapper);
    const menu = wrapper.find('[data-testid="toolbar-more-menu"]');
    expect(menu.exists()).toBe(true);
    expect(menu.children()).toHaveLength(0);
  });
});
