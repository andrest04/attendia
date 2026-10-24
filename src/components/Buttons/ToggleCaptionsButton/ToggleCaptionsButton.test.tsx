import React from 'react';
import { shallow } from 'enzyme';
import ToggleCaptionsButton from './ToggleCaptionsButton';
import { useAppState } from '../../../state';
import CaptionsIcon from '../../../icons/CaptionsIcon';
import CaptionsOffIcon from '../../../icons/CaptionsOffIcon';

jest.mock('../../../state');
const mockUseAppState = useAppState as jest.Mock<any>;

describe('the ToggleCaptionsButton component', () => {
  it('should render correctly when captions are enabled', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: true,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton />);
    const button = wrapper.find('[aria-label="Alternar subtítulos"]');
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
    const button = wrapper.find('[aria-label="Alternar subtítulos"]');
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
    const button = wrapper.find('[aria-label="Alternar subtítulos"]');
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
    const button = wrapper.find('[aria-label="Alternar subtítulos"]');
    expect(button.prop('disabled')).toBe(true);
  });

  it('should apply className prop', () => {
    const mockSetIsCaptionsEnabled = jest.fn();
    mockUseAppState.mockImplementation(() => ({
      isCaptionsEnabled: false,
      setIsCaptionsEnabled: mockSetIsCaptionsEnabled,
    }));
    const wrapper = shallow(<ToggleCaptionsButton className="test-class" />);
    const button = wrapper.find('[aria-label="Alternar subtítulos"]');
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
    expect(tooltip.prop('title')).toBe('Requiere habilitar las transcripciones en tiempo real en la consola de Twilio');
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
