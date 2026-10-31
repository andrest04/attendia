import React from 'react';
import LocalVideoPreview from './LocalVideoPreview';
import { IVideoContext } from '../../../VideoProvider/videoContext';
import { shallow } from 'enzyme';
import RoleBadge from '../../../RoleBadge/RoleBadge';
import IdentityRoleBadge from '../../../RoleBadge/IdentityRoleBadge';
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
  describe('the identity bar', () => {
    const withCamera = () =>
      mockedVideoContext.mockImplementation(
        () =>
          ({
            localTracks: [
              {
                name: '',
                kind: 'video',
                attach: jest.fn(),
                detach: jest.fn(),
                mediaStreamTrack: { getSettings: () => ({}) },
              },
            ],
          } as any)
      );

    it('shows the teacher role as a badge instead of the raw identity suffix', () => {
      withCamera();
      const wrapper = shallow(<LocalVideoPreview identity={'Ana Gomez [Profesor]'} />);
      expect(wrapper.find(IdentityRoleBadge).dive().find(RoleBadge)).toHaveLength(1);
      expect(wrapper.text()).toContain('Ana Gomez');
      expect(wrapper.text()).not.toContain('[Profesor]');
    });

    it('shows no badge for a student', () => {
      withCamera();
      const wrapper = shallow(<LocalVideoPreview identity="Ana Gomez" />);
      expect(wrapper.find(IdentityRoleBadge).dive().find(RoleBadge)).toHaveLength(0);
    });
  });
});
