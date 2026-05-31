import React from 'react';
import { shallow } from 'enzyme';
import { Button } from '@material-ui/core';
import ToggleAttentionButton from './ToggleAttentionButton';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

jest.mock('../../../hooks/useChatContext/useChatContext');
jest.mock('../../../hooks/useVideoContext/useVideoContext');

const mockUseChatContext = useChatContext as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

const mockSetIsAttentionPanelOpen = jest.fn();
const mockSetIsChatWindowOpen = jest.fn();
const mockSetIsBackgroundSelectionOpen = jest.fn();

mockUseChatContext.mockImplementation(() => ({
  isAttentionPanelOpen: false,
  setIsAttentionPanelOpen: mockSetIsAttentionPanelOpen,
  setIsChatWindowOpen: mockSetIsChatWindowOpen,
}));

mockUseVideoContext.mockImplementation(() => ({
  setIsBackgroundSelectionOpen: mockSetIsBackgroundSelectionOpen,
}));

describe('ToggleAttentionButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChatContext.mockImplementation(() => ({
      isAttentionPanelOpen: false,
      setIsAttentionPanelOpen: mockSetIsAttentionPanelOpen,
      setIsChatWindowOpen: mockSetIsChatWindowOpen,
    }));
    mockUseVideoContext.mockImplementation(() => ({
      setIsBackgroundSelectionOpen: mockSetIsBackgroundSelectionOpen,
    }));
  });

  it('renders the button with "Mi Atención" label', () => {
    const wrapper = shallow(<ToggleAttentionButton />);
    expect(wrapper.find(Button).text()).toContain('Mi Atención');
  });

  it('opens the attention panel when clicked (panel was closed)', () => {
    const wrapper = shallow(<ToggleAttentionButton />);
    wrapper.find(Button).simulate('click');
    expect(mockSetIsAttentionPanelOpen).toHaveBeenCalledWith(true);
  });

  it('closes competing panels when opening the attention panel', () => {
    const wrapper = shallow(<ToggleAttentionButton />);
    wrapper.find(Button).simulate('click');
    expect(mockSetIsChatWindowOpen).toHaveBeenCalledWith(false);
    expect(mockSetIsBackgroundSelectionOpen).toHaveBeenCalledWith(false);
  });

  it('closes the attention panel when clicked (panel was open)', () => {
    mockUseChatContext.mockImplementationOnce(() => ({
      isAttentionPanelOpen: true,
      setIsAttentionPanelOpen: mockSetIsAttentionPanelOpen,
      setIsChatWindowOpen: mockSetIsChatWindowOpen,
    }));
    const wrapper = shallow(<ToggleAttentionButton />);
    wrapper.find(Button).simulate('click');
    expect(mockSetIsAttentionPanelOpen).toHaveBeenCalledWith(false);
  });

  it('does NOT close competing panels when closing the attention panel', () => {
    mockUseChatContext.mockImplementationOnce(() => ({
      isAttentionPanelOpen: true,
      setIsAttentionPanelOpen: mockSetIsAttentionPanelOpen,
      setIsChatWindowOpen: mockSetIsChatWindowOpen,
    }));
    const wrapper = shallow(<ToggleAttentionButton />);
    wrapper.find(Button).simulate('click');
    expect(mockSetIsChatWindowOpen).not.toHaveBeenCalled();
    expect(mockSetIsBackgroundSelectionOpen).not.toHaveBeenCalled();
  });
});
