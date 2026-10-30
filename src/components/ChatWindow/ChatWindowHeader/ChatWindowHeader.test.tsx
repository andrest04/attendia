import React from 'react';
import { shallow } from 'enzyme';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { I18nextProvider, setI18n } from 'react-i18next';
import i18n from '../../../i18n/testInit';
import { createI18n } from '../../../i18n/createI18n';

import CloseIcon from '../../../icons/CloseIcon';
import ChatWindowHeader from './ChatWindowHeader';
import useChatContext from '../../../hooks/useChatContext/useChatContext';

jest.mock('../../../hooks/useChatContext/useChatContext');

const mockUseChatContext = useChatContext as jest.Mock<any>;

const mockToggleChatWindow = jest.fn();
mockUseChatContext.mockImplementation(() => ({ setIsChatWindowOpen: mockToggleChatWindow }));

describe('the CloseChatWindowHeader component', () => {
  afterEach(() => { cleanup(); setI18n(i18n); });

  it.each([['es', 'Cerrar chat'], ['en', 'Close chat']])('names and closes chat in %s', (language, label) => {
    const { getByRole } = render(
      <I18nextProvider i18n={createI18n({ detect: false, lng: language })}>
        <ChatWindowHeader />
      </I18nextProvider>
    );
    fireEvent.click(getByRole('button', { name: label }));
    expect(mockToggleChatWindow).toHaveBeenCalledWith(false);
  });
  it('should close the chat window when "X" is clicked on', () => {
    const wrapper = shallow(<ChatWindowHeader />);
    wrapper
      .find(CloseIcon)
      .parent()
      .simulate('click');
    expect(mockToggleChatWindow).toHaveBeenCalledWith(false);
  });
});
