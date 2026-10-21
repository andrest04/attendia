import React from 'react';
import { mount } from 'enzyme';
import { MemoryRouter } from 'react-router-dom';
import PhoneBlockedScreen from './PhoneBlockedScreen';
import PhoneGate from './PhoneGate';

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36';

const render = (userAgent: string, path = '/') =>
  mount(
    <MemoryRouter initialEntries={[path]}>
      <PhoneGate userAgent={userAgent}>
        <div id="app">app</div>
      </PhoneGate>
    </MemoryRouter>
  );

describe('PhoneBlockedScreen', () => {
  it('explains in Spanish that phones are not supported', () => {
    const wrapper = mount(<PhoneBlockedScreen />);
    expect(wrapper.text()).toContain('Esta plataforma no está disponible en celulares');
    expect(wrapper.text()).toContain('computador o tablet');
  });
});

describe('PhoneGate', () => {
  it('shows the blocked screen instead of the app on a phone', () => {
    const wrapper = render(PHONE);
    expect(wrapper.find(PhoneBlockedScreen)).toHaveLength(1);
    expect(wrapper.find('#app').exists()).toBe(false);
  });

  it('renders the app on a desktop', () => {
    const wrapper = render(DESKTOP);
    expect(wrapper.find(PhoneBlockedScreen).exists()).toBe(false);
    expect(wrapper.find('#app').exists()).toBe(true);
  });

  it('keeps /security reachable on a phone', () => {
    const wrapper = render(PHONE, '/security');
    expect(wrapper.find(PhoneBlockedScreen).exists()).toBe(false);
    expect(wrapper.find('#app').exists()).toBe(true);
  });
});
