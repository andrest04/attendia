import React from 'react';
import { mount } from 'enzyme';
import { EMPHASIS_MARK, emphasize } from './richText';

describe('emphasize', () => {
  it('wraps the value where the placeholder was in <strong>', () => {
    const wrapper = mount(<p>{emphasize(`Room ${EMPHASIS_MARK} is open.`, 'algebra')}</p>);
    expect(wrapper.text()).toBe('Room algebra is open.');
    expect(wrapper.find('strong').text()).toBe('algebra');
  });

  it('forwards props and a custom tag to the wrapper', () => {
    const wrapper = mount(<p>{emphasize(`${EMPHASIS_MARK}!`, 'Ana', { className: 'name' }, 'span')}</p>);
    expect(wrapper.find('span.name').text()).toBe('Ana');
  });

  it('returns the sentence untouched when there is no placeholder', () => {
    expect(emphasize('No placeholder', 'x')).toBe('No placeholder');
  });
});
