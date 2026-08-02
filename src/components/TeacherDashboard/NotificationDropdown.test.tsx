import React from 'react';
import { shallow } from 'enzyme';
import { Button, CircularProgress, IconButton, ListItem, ListItemText, MenuItem } from '@material-ui/core';
import { TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import NotificationDropdown from './NotificationDropdown';

const notification = (id: string, readAtMs: number | null = null): TeacherNotification => ({
  notificationId: id,
  ownerUid: 'teacher-1',
  eventType: 'class.upcoming',
  eventKey: `class:${id}:upcoming`,
  source: { kind: 'class', classId: id },
  eventOccurrenceAtMs: 20,
  createdAtMs: 21,
  readAtMs,
  title: `Título ${id}`,
  message: `Mensaje ${id}`,
  destination: { kind: 'classes' },
});

const baseProps = {
  notifications: [] as TeacherNotification[],
  unreadCount: 0,
  hasConfirmedState: true,
  hasMore: false,
  isLoadingMore: false,
  pendingReadId: null as string | null,
  isMarkingAll: false,
  isClearing: false,
  refreshError: null as Error | null,
  paginationError: null as Error | null,
  readError: null as Error | null,
  markAllError: null as Error | null,
  clearError: null as Error | null,
  reconcileError: null as Error | null,
  onNotificationClick: jest.fn(),
  onLoadMore: jest.fn(),
  onMarkAllRead: jest.fn(),
  onClearAll: jest.fn(),
};

describe('NotificationDropdown', () => {
  beforeEach(jest.clearAllMocks);

  it('shows loading before a confirmed response and only then the exact empty copy', () => {
    const loading = shallow(<NotificationDropdown {...baseProps} hasConfirmedState={false} />);
    expect(loading.find(CircularProgress).exists()).toBe(true);
    expect(loading.text()).not.toContain('Estás al día');

    const empty = shallow(<NotificationDropdown {...baseProps} />);
    expect(empty.find(CircularProgress).exists()).toBe(false);
    expect(empty.text()).toContain('Estás al día');
  });

  it('renders supplied newest-first rows and delegates row and paging actions', () => {
    const items = [notification('new'), notification('old', 22)];
    const wrapper = shallow(<NotificationDropdown {...baseProps} notifications={items} unreadCount={1} hasMore />);

    const rows = wrapper.find(ListItem);
    expect(rows.map(row => row.prop('data-testid'))).toEqual(['notification-row-new', 'notification-row-old']);
    expect(rows.at(0).find(ListItemText).prop('primary')).toBe('Título new');
    expect(rows.at(1).find(ListItemText).prop('secondary')).toEqual(
      expect.objectContaining({ props: expect.objectContaining({ children: 'Mensaje old' }) })
    );

    rows.at(0).simulate('click');
    wrapper.find(Button).filterWhere(button => button.text() === 'Cargar más').simulate('click');
    expect(baseProps.onNotificationClick).toHaveBeenCalledWith(items[0]);
    expect(baseProps.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('offers mark-all and immediate clear from the overflow menu with an unread warning and no dialog', () => {
    const wrapper = shallow(
      <NotificationDropdown {...baseProps} notifications={[notification('one')]} unreadCount={1} />
    );

    expect(wrapper.text()).toContain('Tienes notificaciones sin leer');
    expect(wrapper.find('Dialog').exists()).toBe(false);
    wrapper.find(IconButton).simulate('click', { currentTarget: document.createElement('button') });
    wrapper.find(MenuItem).filterWhere(item => item.text() === 'Marcar todas como leídas').simulate('click');
    wrapper.find(MenuItem).filterWhere(item => item.text() === 'Vaciar notificaciones').simulate('click');
    expect(baseProps.onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(baseProps.onClearAll).toHaveBeenCalledTimes(1);

    wrapper.setProps({ unreadCount: 0 });
    expect(wrapper.text()).not.toContain('Tienes notificaciones sin leer');
  });

  it('preserves confirmed rows while showing isolated errors and disabling pending actions', () => {
    const wrapper = shallow(
      <NotificationDropdown
        {...baseProps}
        notifications={[notification('kept')]}
        unreadCount={1}
        hasMore
        isLoadingMore
        pendingReadId="kept"
        isMarkingAll
        isClearing
        refreshError={new Error('refresh')}
        paginationError={new Error('page')}
        readError={new Error('read')}
        markAllError={new Error('mark')}
        clearError={new Error('clear')}
        reconcileError={new Error('reconcile')}
      />
    );

    expect(wrapper.find('[data-testid="notification-row-kept"]').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').map(node => node.text())).toEqual([
      'No pudimos actualizar las notificaciones.',
      'No pudimos cargar más notificaciones.',
      'No pudimos marcar la notificación como leída.',
      'No pudimos marcar todas como leídas.',
      'No pudimos vaciar las notificaciones.',
      'No pudimos sincronizar las notificaciones.',
    ]);
    expect(wrapper.find('[data-testid="notification-row-kept"]').prop('disabled')).toBe(true);
    expect(wrapper.find(Button).filterWhere(button => button.text() === 'Cargar más').prop('disabled')).toBe(true);
    expect(wrapper.find(MenuItem).filterWhere(item => item.text() === 'Marcar todas como leídas').prop('disabled')).toBe(true);
    expect(wrapper.find(MenuItem).filterWhere(item => item.text() === 'Vaciar notificaciones').prop('disabled')).toBe(true);
  });
});
