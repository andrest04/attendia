import React from 'react';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider, setI18n } from 'react-i18next';
import testI18n from '../../../i18n/testInit';
import { createI18n } from '../../../i18n/createI18n';
import es from '../../../i18n/locales/completeControls.es';
import en from '../../../i18n/locales/completeControls.en';
import ToggleCaptionsButton from './ToggleCaptionsButton';
import { useAppState } from '../../../state';
import CaptionsIcon from '../../../icons/CaptionsIcon';
import CaptionsOffIcon from '../../../icons/CaptionsOffIcon';
import i18n from '../../../i18n';

jest.mock('../../../state');
const mockUseAppState = useAppState as jest.Mock<any>;

describe('the ToggleCaptionsButton component', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es');
  });
  it('updates the caption controls while mounted when the language changes', async () => {
    const localI18n = createI18n({ detect: false, lng: 'es' });
    localI18n.addResourceBundle('es', 'completeControls', es);
    localI18n.addResourceBundle('en', 'completeControls', en);
    mockUseAppState.mockImplementation(() => ({ isCaptionsEnabled: false, setIsCaptionsEnabled: jest.fn() }));
    const wrapper = mount(<I18nextProvider i18n={localI18n}><ToggleCaptionsButton /></I18nextProvider>);
    expect(wrapper.find('button').prop('aria-label')).toBe(es.captionsAria);
    expect(wrapper.find('[data-testid="captions-tooltip"]').first().prop('title')).toBe(es.captionsRequirement);
    await act(async () => { await localI18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.find('button').prop('aria-label')).toBe(en.captionsAria);
    expect(wrapper.find('[data-testid="captions-tooltip"]').first().prop('title')).toBe(en.captionsRequirement);
    wrapper.unmount();
    setI18n(testI18n);
  });
  it('should render correctly when captions are enabled', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: true,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton />);
    const button = wrapper.find(`[aria-label="${es.captionsAria}"]`);
    expect(button.prop('startIcon')).toEqual(<CaptionsIcon />);
    expect(button.text()).toBe('Subtítulos');
  });

  it('should render correctly when captions are disabled', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: false,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton />);
    const button = wrapper.find(`[aria-label="${es.captionsAria}"]`);
    expect(button.prop('startIcon')).toEqual(<CaptionsOffIcon />);
    expect(button.text()).toBe('Subtítulos');
  });

  it('should call the correct toggle function when clicked', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: false,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton />);
    const button = wrapper.find(`[aria-label="${es.captionsAria}"]`);
    button.simulate('click');
    expect(mockSetIsCaptionsEnabled).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: false,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton disabled={true} />);
    const button = wrapper.find(`[aria-label="${es.captionsAria}"]`);
    expect(button.prop('disabled')).toBe(true);
  });

  it('should apply className prop', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: false,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton className="test-class" />);
    const button = wrapper.find(`[aria-label="${es.captionsAria}"]`);
    expect(button.prop('className')).toContain('test-class');
  });

  it('should show tooltip when captions are disabled', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: false,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton />);
    const tooltip = wrapper.find('[data-testid="captions-tooltip"]');
    expect(tooltip.prop('title')).toBe(es.captionsRequirement);
  });

  it('should not show tooltip when captions are enabled', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: true,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton />);
    const tooltip = wrapper.find('[data-testid="captions-tooltip"]');
    expect(tooltip.prop('title')).toBe('');
  });
});
