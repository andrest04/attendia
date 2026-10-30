import { shallow } from 'enzyme';
import React from 'react';
import Snackbar from './Snackbar';
import i18n from '../../i18n/testInit';
import en from '../../i18n/locales/completeControls.en';

i18n.addResourceBundle('en', 'completeControls', en);

describe('the Snackbar component', () => {
  it('should render correctly with "warning" variant', () => {
    const wrapper = shallow(
      <Snackbar variant="warning" headline="Test Headline" message="Test Message" handleClose={() => {}} open={true} />
    );
    expect(wrapper).toMatchSnapshot();
    i18n.changeLanguage('es');
  });

  it('should render correctly with "error" variant', () => {
    const wrapper = shallow(
      <Snackbar variant="error" headline="Test Headline" message="Test Message" handleClose={() => {}} open={true} />
    );
    expect(wrapper).toMatchSnapshot();
    i18n.changeLanguage('es');
  });

  it('should render correctly with "info" variant', () => {
    const wrapper = shallow(
      <Snackbar variant="info" headline="Test Headline" message="Test Message" handleClose={() => {}} open={true} />
    );
    expect(wrapper).toMatchSnapshot();
    i18n.changeLanguage('es');
  });

  it('should render correctly with no handleClose function provided', () => {
    const wrapper = shallow(<Snackbar variant="error" headline="Test Headline" message="Test Message" open={true} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('localizes the close label in English', () => {
    i18n.changeLanguage('en');
    const wrapper = shallow(<Snackbar headline="Headline" message="Message" handleClose={() => {}} open />);
    expect(wrapper.find('[aria-label]').prop('aria-label')).toBe(en.close);
    i18n.changeLanguage('es');
  });

  describe('the handleClose function', () => {
    beforeEach(jest.clearAllMocks);

    const mockHandleClose = jest.fn();
    const wrapper = shallow(
      <Snackbar
        variant="warning"
        headline="Test Headline"
        message="Test Message"
        handleClose={mockHandleClose}
        open={true}
      />
    );

    it('should be called when the onClose function is called', () => {
      wrapper.prop('onClose')();
      expect(mockHandleClose).toHaveBeenCalled();
    });

    it('should be called when the onClose function is called with the "clickaway" reason', () => {
      wrapper.prop('onClose')({}, 'clickaway');
      expect(mockHandleClose).not.toHaveBeenCalled();
    });
  });
});
