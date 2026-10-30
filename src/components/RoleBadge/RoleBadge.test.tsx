import React from 'react';
import { shallow } from 'enzyme';
import { act, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import SchoolIcon from '@material-ui/icons/School';
import RoleBadge from './RoleBadge';

describe('the RoleBadge component', () => {
  it('renders the "Profesor" label with a graduation-cap icon', () => {
    const wrapper = shallow(<RoleBadge />);
    expect(wrapper.text()).toContain('Profesor');
    expect(wrapper.find(SchoolIcon).exists()).toBe(true);
  });

  it('updates the visible role when the language changes', async () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    const { getByTestId } = render(<I18nextProvider i18n={i18n}><RoleBadge size="sm" /></I18nextProvider>);
    expect(getByTestId('role-badge-teacher').textContent).toContain('Profesor');
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(getByTestId('role-badge-teacher').textContent).toContain('Teacher');
    await act(async () => { await i18n.changeLanguage('es'); });
    expect(getByTestId('role-badge-teacher').textContent).toContain('Profesor');
  });

  it('exposes a stable test id for consumers', () => {
    const wrapper = shallow(<RoleBadge />);
    expect(wrapper.find('[data-testid="role-badge-teacher"]').exists()).toBe(true);
  });

  it('supports a compact size for tile overlays', () => {
    const wrapper = shallow(<RoleBadge size="sm" />);
    expect(wrapper.text()).toContain('Profesor');
  });
});
