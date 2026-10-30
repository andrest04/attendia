import React from 'react';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider, setI18n } from 'react-i18next';
import testI18n from '../../../i18n/testInit';
import { createI18n } from '../../../i18n/createI18n';

import EndCallButton from './EndCallButton';
import { clearRejoinSession } from '../../../classSession/rejoinSession';

const mockVideoContext: { room: { disconnect: jest.Mock } | null } = {
  room: {
    disconnect: jest.fn(),
  },
};

jest.mock('../../../hooks/useVideoContext/useVideoContext', () => () => mockVideoContext);
jest.mock('../../../classSession/rejoinSession', () => ({
  clearRejoinSession: jest.fn(),
}));

const mockClearRejoinSession = clearRejoinSession as jest.Mock;
const mainButton = (wrapper: any) => wrapper.find('[data-cy-disconnect]');

describe('End Call button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVideoContext.room = { disconnect: jest.fn() };
  });

  describe('without onEndForAll (student)', () => {
    it('should disconnect from the room when clicked', () => {
      const wrapper = shallow(<EndCallButton />);
      mainButton(wrapper).simulate('click');
      expect(mockVideoContext.room!.disconnect).toHaveBeenCalled();
    });

    it('should clear the rejoin session before disconnecting', () => {
      const wrapper = shallow(<EndCallButton />);
      mainButton(wrapper).simulate('click');
      expect(mockClearRejoinSession).toHaveBeenCalled();
    });

    it('does not throw when clicked while room is already null and still clears the rejoin session', () => {
      // A page refresh / double-click race can disconnect the room first (via
      // 'beforeunload'), leaving room null. Clicking "Salir" must not throw.
      mockVideoContext.room = null;
      const wrapper = shallow(<EndCallButton />);
      expect(() => mainButton(wrapper).simulate('click')).not.toThrow();
      expect(mockClearRejoinSession).toHaveBeenCalled();
    });
  });

  describe('with onEndForAll (teacher)', () => {
    it('opens the confirm dialog instead of leaving immediately', () => {
      const onEndForAll = jest.fn();
      const wrapper = shallow(<EndCallButton onEndForAll={onEndForAll} />);
      expect(wrapper.find('[data-testid="end-call-dialog"]').prop('open')).toBe(false);

      mainButton(wrapper).simulate('click');

      expect(wrapper.find('[data-testid="end-call-dialog"]').prop('open')).toBe(true);
      expect(mockVideoContext.room!.disconnect).not.toHaveBeenCalled();
      expect(onEndForAll).not.toHaveBeenCalled();
    });

    it('"Salir sin cerrar" leaves without ending for everyone', () => {
      const onEndForAll = jest.fn();
      const wrapper = shallow(<EndCallButton onEndForAll={onEndForAll} />);
      mainButton(wrapper).simulate('click');

      wrapper.find('[data-testid="end-call-leave"]').simulate('click');

      expect(mockClearRejoinSession).toHaveBeenCalled();
      expect(mockVideoContext.room!.disconnect).toHaveBeenCalled();
      expect(onEndForAll).not.toHaveBeenCalled();
    });

    it('"Salir sin cerrar" delegates to onLeave when provided (professor report snapshot path)', () => {
      const onEndForAll = jest.fn();
      const onLeave = jest.fn();
      const wrapper = shallow(<EndCallButton onEndForAll={onEndForAll} onLeave={onLeave} />);
      mainButton(wrapper).simulate('click');

      wrapper.find('[data-testid="end-call-leave"]').simulate('click');

      expect(onLeave).toHaveBeenCalledTimes(1);
      // The delegate owns the whole leave (clear rejoin + disconnect) — the
      // default body must not also run.
      expect(mockClearRejoinSession).not.toHaveBeenCalled();
      expect(mockVideoContext.room!.disconnect).not.toHaveBeenCalled();
      expect(onEndForAll).not.toHaveBeenCalled();
    });

    it('"Terminar para todos" invokes the end-for-all callback', () => {
      const onEndForAll = jest.fn();
      const wrapper = shallow(<EndCallButton onEndForAll={onEndForAll} />);
      mainButton(wrapper).simulate('click');

      wrapper.find('[data-testid="end-call-end-for-all"]').simulate('click');

      expect(onEndForAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('dialog behavior', () => {
    it('associates the open dialog with its translated title in both languages', async () => {
      const i18n = createI18n({ detect: false, lng: 'es' });
      const wrapper = mount(<I18nextProvider i18n={i18n}><EndCallButton onEndForAll={jest.fn()} /></I18nextProvider>);
      wrapper.find('[data-cy-disconnect]').first().simulate('click');
      const checkTitle = (title: string) => {
        const dialog = document.querySelector('[role="dialog"]')!;
        const id = dialog.getAttribute('aria-labelledby');
        expect(id).toBeTruthy();
        expect(document.getElementById(id!)!.textContent).toBe(title);
      };
      checkTitle('¿Terminar la sesión?');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      checkTitle('End the session?');
      wrapper.unmount();
      setI18n(testI18n);
    });

    it('closes the dialog when "Salir sin cerrar" is clicked', () => {
      const wrapper = shallow(<EndCallButton onEndForAll={jest.fn()} />);
      mainButton(wrapper).simulate('click');
      expect(wrapper.find('[data-testid="end-call-dialog"]').prop('open')).toBe(true);

      wrapper.find('[data-testid="end-call-leave"]').simulate('click');

      expect(wrapper.find('[data-testid="end-call-dialog"]').prop('open')).toBe(false);
    });

    it('disables every dialog action and shows a busy label while isEnding', () => {
      const wrapper = shallow(<EndCallButton onEndForAll={jest.fn()} isEnding />);
      expect(wrapper.find('[data-testid="end-call-cancel"]').prop('disabled')).toBe(true);
      expect(wrapper.find('[data-testid="end-call-leave"]').prop('disabled')).toBe(true);
      expect(wrapper.find('[data-testid="end-call-end-for-all"]').prop('disabled')).toBe(true);
      expect(
        wrapper
          .find('[data-testid="end-call-end-for-all"]')
          .children()
          .text()
      ).toBe('Terminando…');
    });

    it('keeps the dialog actions enabled when not ending', () => {
      const wrapper = shallow(<EndCallButton onEndForAll={jest.fn()} />);
      expect(wrapper.find('[data-testid="end-call-end-for-all"]').prop('disabled')).toBeFalsy();
    });
  });
});
