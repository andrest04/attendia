import React from 'react';
import { shallow } from 'enzyme';
import AttentionConsentModal from './AttentionConsentModal';
import { Dialog } from '@material-ui/core';

// AttentionConsentModal uses MUI Dialog. With Enzyme shallow(), we get one level
// deep — the Dialog stub — and can assert on its props and on the children via
// wrapper.dive() or by inspecting the shallow tree's text via wrapper.html().

describe('AttentionConsentModal', () => {
  const defaultProps = {
    open: true,
    onAccept: jest.fn(),
    onDecline: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes open={false} to Dialog when closed', () => {
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} open={false} />);
    expect(wrapper.find(Dialog).prop('open')).toBe(false);
  });

  it('passes open={true} to Dialog when open', () => {
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} />);
    expect(wrapper.find(Dialog).prop('open')).toBe(true);
  });

  it('renders the "Aceptar" button with data-cy-consent-accept', () => {
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} />);
    expect(wrapper.find('[data-cy-consent-accept]').exists()).toBe(true);
  });

  it('renders the "Volver" button with data-cy-consent-decline', () => {
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} />);
    expect(wrapper.find('[data-cy-consent-decline]').exists()).toBe(true);
  });

  it('calls onAccept when "Aceptar" is clicked', () => {
    const onAccept = jest.fn();
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} onAccept={onAccept} />);
    wrapper.find('[data-cy-consent-accept]').simulate('click');
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onDecline when "Volver" is clicked', () => {
    const onDecline = jest.fn();
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} onDecline={onDecline} />);
    wrapper.find('[data-cy-consent-decline]').simulate('click');
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('includes a link to the privacy page /security', () => {
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} />);
    expect(wrapper.find('a[href="/security"]').exists()).toBe(true);
  });

  it('mentions on-device processing somewhere in the rendered JSX tree', () => {
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} />);
    // shallow() renders the JSX tree but doesn't descend into MUI components.
    // We can still walk the tree text for strings that live in plain JSX nodes.
    const treeText = wrapper.debug();
    expect(treeText).toMatch(/dispositivo|local/i);
  });

  it('mentions in-person alternative somewhere in the rendered JSX tree', () => {
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} />);
    const treeText = wrapper.debug();
    expect(treeText).toMatch(/presencial|alternativa/i);
  });

  it('has disableBackdropClick so students cannot dismiss it accidentally', () => {
    const wrapper = shallow(<AttentionConsentModal {...defaultProps} />);
    expect(wrapper.find(Dialog).prop('disableBackdropClick')).toBe(true);
  });
});
