import React from 'react';
import { shallow } from 'enzyme';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import UnmuteRequestPrompt, { UNMUTE_REQUEST_TEXT } from './UnmuteRequestPrompt';

describe('UnmuteRequestPrompt', () => {
  it('stays closed without a pending request', () => {
    const wrapper = shallow(<UnmuteRequestPrompt open={false} onAccept={jest.fn()} onDismiss={jest.fn()} />);
    expect(wrapper.find(Snackbar).prop('open')).toBe(false);
  });

  it('asks in Spanish and enables the mic only through the "Activar" click', () => {
    const onAccept = jest.fn();
    const wrapper = shallow(<UnmuteRequestPrompt open onAccept={onAccept} onDismiss={jest.fn()} />);
    const snackbar = wrapper.find(Snackbar);
    expect(snackbar.prop('open')).toBe(true);
    expect(snackbar.prop('message')).toBe(UNMUTE_REQUEST_TEXT);
    expect(UNMUTE_REQUEST_TEXT).toBe('El profesor te pide activar tu micrófono');

    const action = shallow(<div>{snackbar.prop('action') as React.ReactNode}</div>);
    const activate = action.find(Button).filterWhere(b => b.children().text() === 'Activar');
    expect(onAccept).not.toHaveBeenCalled();
    activate.simulate('click');
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed without accepting', () => {
    const onDismiss = jest.fn();
    const onAccept = jest.fn();
    const wrapper = shallow(<UnmuteRequestPrompt open onAccept={onAccept} onDismiss={onDismiss} />);
    const action = shallow(<div>{wrapper.find(Snackbar).prop('action') as React.ReactNode}</div>);
    action
      .find(Button)
      .filterWhere(b => b.children().text() === 'Ahora no')
      .simulate('click');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });
});
