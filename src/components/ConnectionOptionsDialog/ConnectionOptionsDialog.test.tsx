import React from 'react';
import ConnectionOptionsDialog from './ConnectionOptionsDialog';
import { initialSettings } from '../../state/settings/settingsReducer';
import { Select, TextField } from '@material-ui/core';
import { mount, shallow } from 'enzyme';
import { useAppState } from '../../state';
import useRoomState from '../../hooks/useRoomState/useRoomState';
import i18n from '../../i18n/testInit';
import es from '../../i18n/locales/completeControls.es';
import en from '../../i18n/locales/completeControls.en';

jest.mock('../../hooks/useRoomState/useRoomState');
jest.mock('../../state');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseRoomState = useRoomState as jest.Mock<any>;

const mockDispatchSetting = jest.fn();
mockUseAppState.mockImplementation(() => ({ settings: initialSettings, dispatchSetting: mockDispatchSetting }));

describe('the ConnectionOptionsDialog component', () => {
  afterEach(jest.clearAllMocks);

  it('shows the connection settings title in both languages', async () => {
    i18n.addResourceBundle('es', 'completeControls', es);
    i18n.addResourceBundle('en', 'completeControls', en);
    await i18n.changeLanguage('es');
    expect(shallow(<ConnectionOptionsDialog open={true} onClose={() => {}} />).text()).toContain('Configuración de conexión');
    await i18n.changeLanguage('en');
    expect(shallow(<ConnectionOptionsDialog open={true} onClose={() => {}} />).text()).toContain('Connection Settings');
    await i18n.changeLanguage('es');
  });

  it('exposes translated names for all selects in multiple open dialogs', async () => {
    i18n.addResourceBundle('es', 'completeControls', es);
    i18n.addResourceBundle('en', 'completeControls', en);
    mockUseRoomState.mockReturnValue('disconnected');
    for (const [language, translations] of [['es', es], ['en', en]] as const) {
      await i18n.changeLanguage(language);
      const wrapper = mount(<div><ConnectionOptionsDialog open onClose={() => {}} /><ConnectionOptionsDialog open onClose={() => {}} /></div>);
      const controls = wrapper.find('[role="button"]').hostNodes().filterWhere(node => node.getDOMNode().hasAttribute('aria-labelledby'));
      expect(controls.map(node => {
        const labelId = node.getDOMNode().getAttribute('aria-labelledby')!.split(' ')[0];
        return wrapper.find('label').hostNodes().filterWhere(label => label.getDOMNode().id === labelId).text();
      })).toEqual([
        translations.dominantPriority, translations.switchOffMode, translations.mode, translations.clientSwitchOff, translations.contentPreferences,
        translations.dominantPriority, translations.switchOffMode, translations.mode, translations.clientSwitchOff, translations.contentPreferences,
      ]);
      const ids = wrapper.find('[id]').hostNodes().map(node => node.getDOMNode().id);
      expect(new Set(ids).size).toBe(ids.length);
      wrapper.unmount();
    }
    await i18n.changeLanguage('es');
  });

  describe('when not connected to a room', () => {
    beforeEach(() => mockUseRoomState.mockReturnValue('disconnected'));
    it('enables the connection controls', () => {
      const wrapper = shallow(<ConnectionOptionsDialog open={true} onClose={() => {}} />);
      expect(wrapper.find(Select).everyWhere(control => !control.prop('disabled'))).toBe(true);
      expect(wrapper.find(TextField).prop('disabled')).toBe(false);
      expect(wrapper).toMatchSnapshot();
    });

    it('should dispatch settings changes', () => {
      const wrapper = shallow(<ConnectionOptionsDialog open={true} onClose={() => {}} />);
      wrapper
        .find(Select)
        .find({ name: 'dominantSpeakerPriority' })
        .simulate('change', { target: { value: 'testValue', name: 'dominantSpeakerPriority' } });
      expect(mockDispatchSetting).toHaveBeenCalledWith({ value: 'testValue', name: 'dominantSpeakerPriority' });
    });

    it('should not dispatch settings changes from a number field when there are non-digits in the value', () => {
      const wrapper = shallow(<ConnectionOptionsDialog open={true} onClose={() => {}} />);
      wrapper
        .find(TextField)
        .find({ name: 'maxAudioBitrate' })
        .simulate('change', { target: { value: '123456a', name: 'maxAudioBitrate' } });
      expect(mockDispatchSetting).not.toHaveBeenCalled();
    });

    it('should dispatch settings changes from a number field when there are only digits in the value', () => {
      const wrapper = shallow(<ConnectionOptionsDialog open={true} onClose={() => {}} />);
      wrapper
        .find(TextField)
        .find({ name: 'maxAudioBitrate' })
        .simulate('change', { target: { value: '123456', name: 'maxAudioBitrate' } });
      expect(mockDispatchSetting).toHaveBeenCalledWith({ value: '123456', name: 'maxAudioBitrate' });
    });
  });

  describe('when connected to a room', () => {
    beforeEach(() => mockUseRoomState.mockReturnValue('connected'));
    it('disables the connection controls', () => {
      const wrapper = shallow(<ConnectionOptionsDialog open={true} onClose={() => {}} />);
      expect(wrapper.find(Select).everyWhere(control => control.prop('disabled') === true)).toBe(true);
      expect(wrapper.find(TextField).prop('disabled')).toBe(true);
      expect(wrapper).toMatchSnapshot();
    });
  });
});
