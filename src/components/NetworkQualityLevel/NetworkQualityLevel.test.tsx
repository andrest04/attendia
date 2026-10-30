import React from 'react';
import renderer from 'react-test-renderer';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import useParticipantNetworkQualityLevel from '../../hooks/useParticipantNetworkQualityLevel/useParticipantNetworkQualityLevel';
import NetworkQualityLevel from './NetworkQualityLevel';

jest.mock('../../hooks/useParticipantNetworkQualityLevel/useParticipantNetworkQualityLevel');
const mockLevel = useParticipantNetworkQualityLevel as jest.Mock;

describe('the NetworkQualityLevel component', () => {
  beforeEach(() => {
    mockLevel.mockImplementation((participant: any) => participant.networkQualityLevel);
  });

  it('exposes the level in the selected language and updates without exposing participant identity', async () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    const participant = { networkQualityLevel: 3, identity: 'private-name' } as any;
    const wrapper = mount(<I18nextProvider i18n={i18n}><NetworkQualityLevel participant={participant} /></I18nextProvider>);
    expect(wrapper.find('[role="img"]').prop('aria-label')).toBe('Calidad de red: 3 de 5');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.find('[role="img"]').prop('aria-label')).toBe('Network quality: 3 of 5');
    participant.networkQualityLevel = 0;
    wrapper.setProps({ children: <NetworkQualityLevel participant={participant} /> });
    expect(wrapper.find('[role="img"]').prop('aria-label')).toBe('Network quality: 0 of 5');
    participant.networkQualityLevel = null;
    wrapper.setProps({ children: <NetworkQualityLevel participant={participant} /> });
    expect(wrapper.find('[role="img"]')).toHaveLength(0);
    wrapper.unmount();
  });
  it('should render correctly for level 5', () => {
    const mockParticipant = { networkQualityLevel: 5, on: () => {} } as any;
    const tree = renderer.create(<NetworkQualityLevel participant={mockParticipant} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('should render correctly for level 3', () => {
    const mockParticipant = { networkQualityLevel: 3, on: () => {} } as any;
    const tree = renderer.create(<NetworkQualityLevel participant={mockParticipant} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('should render correctly for level 0', () => {
    const mockParticipant = { networkQualityLevel: 0, on: () => {} } as any;
    const tree = renderer.create(<NetworkQualityLevel participant={mockParticipant} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
