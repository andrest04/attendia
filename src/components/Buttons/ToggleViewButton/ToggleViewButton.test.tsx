import React from 'react';
import { shallow } from 'enzyme';
import ToggleViewButton from './ToggleViewButton';
import { useAppState } from '../../../state';

jest.mock('../../../state');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockSetIsGalleryViewActive = jest.fn();

describe('ToggleViewButton', () => {
  beforeEach(() => {
    mockSetIsGalleryViewActive.mockClear();
  });

  it('advertises the speaker view when gallery view is active', () => {
    mockUseAppState.mockImplementation(() => ({
      isGalleryViewActive: true,
      setIsGalleryViewActive: mockSetIsGalleryViewActive,
    }));

    const wrapper = shallow(<ToggleViewButton />);
    expect(wrapper.find('[data-testid="student-toolbar-view"]').prop('children')).toBe('Vista de orador');
  });

  it('advertises the gallery view when speaker view is active', () => {
    mockUseAppState.mockImplementation(() => ({
      isGalleryViewActive: false,
      setIsGalleryViewActive: mockSetIsGalleryViewActive,
    }));

    const wrapper = shallow(<ToggleViewButton />);
    expect(wrapper.find('[data-testid="student-toolbar-view"]').prop('children')).toBe('Vista de galería');
  });

  it('flips the gallery view flag on click', () => {
    mockUseAppState.mockImplementation(() => ({
      isGalleryViewActive: false,
      setIsGalleryViewActive: mockSetIsGalleryViewActive,
    }));

    const wrapper = shallow(<ToggleViewButton />);
    wrapper.find('[data-testid="student-toolbar-view"]').simulate('click');
    expect(mockSetIsGalleryViewActive).toHaveBeenCalledTimes(1);

    // The handler toggles the previous value.
    const updater = mockSetIsGalleryViewActive.mock.calls[0][0];
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  it('respects the disabled prop', () => {
    mockUseAppState.mockImplementation(() => ({
      isGalleryViewActive: false,
      setIsGalleryViewActive: mockSetIsGalleryViewActive,
    }));

    const wrapper = shallow(<ToggleViewButton disabled />);
    expect(wrapper.find('[data-testid="student-toolbar-view"]').prop('disabled')).toBe(true);
  });
});
