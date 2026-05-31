import React from 'react';
import AboutDialog from './AboutDialog';
import { render } from '@testing-library/react';
import { useAppState } from '../../state';

jest.mock('twilio-video', () => ({ version: '1.2', isSupported: true }));
jest.mock('../../state');
jest.mock('../../../package.json', () => ({ version: '1.3' }));

const mockUseAppState = useAppState as jest.Mock<any>;
mockUseAppState.mockImplementation(() => ({ roomType: undefined }));

describe('the AboutDialog component', () => {
  it('should display Video.isSupported', () => {
    const { getByText } = render(<AboutDialog open={true} onClose={() => {}} />);
    expect(getByText('Navegador compatible: true')).toBeTruthy();
  });

  it('should display the SDK version', () => {
    const { getByText } = render(<AboutDialog open={true} onClose={() => {}} />);
    expect(getByText('Versión del SDK: 1.2')).toBeTruthy();
  });

  it('should display the package.json version', () => {
    process.env.REACT_APP_VERSION = '1.3';
    const { getByText } = render(<AboutDialog open={true} onClose={() => {}} />);
    expect(getByText('Versión de la app: 1.3')).toBeTruthy();
  });

  it('should not display the room type when it is unknown', () => {
    const { queryByText } = render(<AboutDialog open={true} onClose={() => {}} />);
    expect(queryByText('Tipo de sala:')).not.toBeTruthy();
  });

  it('should display the room type', () => {
    mockUseAppState.mockImplementationOnce(() => ({ roomType: 'group-small' }));
    const { getByText } = render(<AboutDialog open={true} onClose={() => {}} />);
    expect(getByText('Tipo de sala: group-small')).toBeTruthy();
  });

  describe('when running locally', () => {
    beforeEach(() => {
      // @ts-ignore
      process.env = {};
    });

    it('should display N/A as the git tag', () => {
      const { getByText } = render(<AboutDialog open={true} onClose={() => {}} />);
      expect(getByText('Tag desplegado: N/A')).toBeTruthy();
    });

    it('should disaply N/A as the commit hash', () => {
      const { getByText } = render(<AboutDialog open={true} onClose={() => {}} />);
      expect(getByText('Hash del commit desplegado: N/A')).toBeTruthy();
    });
  });

  describe('when deployed via CircleCI', () => {
    beforeEach(() => {
      // @ts-ignore
      process.env = {
        REACT_APP_GIT_TAG: 'v0.1',
        REACT_APP_GIT_COMMIT: '01b2c3',
      };
    });

    it('should display the git tag', () => {
      const { getByText } = render(<AboutDialog open={true} onClose={() => {}} />);
      expect(getByText('Tag desplegado: v0.1')).toBeTruthy();
    });

    it('should display the commit hash', () => {
      const { getByText } = render(<AboutDialog open={true} onClose={() => {}} />);
      expect(getByText('Hash del commit desplegado: 01b2c3')).toBeTruthy();
    });
  });
});
