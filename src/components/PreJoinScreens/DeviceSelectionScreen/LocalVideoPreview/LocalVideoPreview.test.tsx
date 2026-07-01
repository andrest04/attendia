import React from 'react';
import LocalVideoPreview from './LocalVideoPreview';
import { IVideoContext } from '../../../VideoProvider/videoContext';
import { shallow } from 'enzyme';
import useVideoContext from '../../../../hooks/useVideoContext/useVideoContext';

jest.mock('../../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../../../hooks/useMediaStreamTrack/useMediaStreamTrack');

const mockedVideoContext = useVideoContext as jest.Mock<IVideoContext>;

describe('the LocalVideoPreview component', () => {
  it('it should render a VideoTrack component when there is a "camera" track', () => {
    mockedVideoContext.mockImplementation(() => {
      return {
        localTracks: [
          {
            name: '',
            kind: 'video',
            attach: jest.fn(),
            detach: jest.fn(),
            mediaStreamTrack: { getSettings: () => ({}) },
          },
        ],
      } as any;
    });
    const wrapper = shallow(<LocalVideoPreview identity="Test User" />);
    expect(wrapper.find('VideoTrack').exists()).toEqual(true);
  });

  it('should render the initials avatar when there are no "camera" tracks', () => {
    mockedVideoContext.mockImplementation(() => {
      return {
        localTracks: [{ name: 'microphone', attach: jest.fn(), detach: jest.fn() }],
      } as any;
    });
    const wrapper = shallow(<LocalVideoPreview identity="Test User" />);
    // Camera off: shows the initials circle, not a VideoTrack
    expect(wrapper.find('VideoTrack').exists()).toEqual(false);
    // The "Camara activa" chip should be present indicating the avatar state
    expect(wrapper.text()).toContain('TU');
  });
});
