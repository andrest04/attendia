import React from 'react';
import { Media } from '@twilio/conversations';
import MediaMessage, { formatFileSize } from './MediaMessage';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../../../i18n/createI18n';

jest.mock('@material-ui/core/styles/makeStyles', () => () => () => ({}));

describe('the formatFileSize function', () => {
  [
    { bytes: 789, result: '789 bytes' },
    { bytes: 1000, result: '0.98 KB' },
    { bytes: 1234, result: '1.21 KB' },
    { bytes: 67384, result: '65.8 KB' },
    { bytes: 567123, result: '553.83 KB' },
    { bytes: 1000000, result: '976.56 KB' },
    { bytes: 1647987, result: '1.57 MB' },
    { bytes: 23789647, result: '22.69 MB' },
    { bytes: 798234605, result: '761.26 MB' },
    { bytes: 2458769876, result: '2.29 GB' },
  ].forEach(testCase => {
    it(`should format ${testCase.bytes} to "${testCase.result}"`, () => {
      expect(formatFileSize(testCase.bytes)).toBe(testCase.result);
    });
  });
});

describe('the MediaMessage component', () => {
  it('renders a native attachment action with localized size and name in both languages', async () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    const media = { filename: 'informe & datos.txt', size: 123, getContentTemporaryUrl: jest.fn() } as unknown as Media;
    const wrapper = mount(<I18nextProvider i18n={i18n}><MediaMessage media={media} /></I18nextProvider>);
    const button = () => wrapper.find('button');
    expect(button()).toHaveLength(1);
    expect(button().prop('type')).toBe('button');
    expect(button().prop('aria-label')).toBe('Abrir archivo: informe & datos.txt');
    expect(button().text()).toContain('123 octetos');
    expect(button().text()).toContain('informe & datos.txt');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(button().prop('aria-label')).toBe('Open file: informe & datos.txt');
    expect(button().text()).toContain('123 bytes');
    wrapper.setProps({ children: <MediaMessage media={{ ...media, size: 1000 } as Media} /> });
    expect(button().text()).toContain('0.98 KB');
    wrapper.unmount();
  });

  it('should get the file URL and load it in a new tab when clicked', async () => {
    const mockMedia = {
      filename: 'foo.txt',
      size: 123,
      getContentTemporaryUrl: () => Promise.resolve('http://twilio.com/foo.txt'),
    } as Media;

    const mockAnchorElement = document.createElement('a');
    mockAnchorElement.click = jest.fn();
    const createElement = jest.spyOn(document, 'createElement').mockReturnValue(mockAnchorElement);
    jest.useFakeTimers();

    const wrapper = shallow(<MediaMessage media={mockMedia} />);
    wrapper.simulate('click');

    await Promise.resolve();
    expect(mockAnchorElement.href).toBe('http://twilio.com/foo.txt');
    expect(mockAnchorElement.target).toBe('_blank');
    expect(mockAnchorElement.rel).toBe('noopener');
    expect(mockAnchorElement.click).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(mockAnchorElement.click).toHaveBeenCalledTimes(1);
    createElement.mockRestore();
    jest.useRealTimers();
  });
});
