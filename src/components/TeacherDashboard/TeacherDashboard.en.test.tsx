import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { renderHook } from '@testing-library/react-hooks';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { createI18n } from '../../i18n/createI18n';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import DashboardSidebar from './DashboardSidebar';
import DashboardHeader from './DashboardHeader';
import NotificationDropdown from './NotificationDropdown';
import ConfirmDialog from './ConfirmDialog';
import CalendarTab from './CalendarTab';
import useTeacherClasses from './useTeacherClasses';
import useTeacherReports from './useTeacherReports';

jest.mock('../../classSession/checkRoomOpen');

const english = () => createI18n({ detect: false, lng: 'en' });
const wrap = (node: React.ReactElement, i18n = english()) => (
  <I18nextProvider i18n={i18n}>
    <MemoryRouter>{node}</MemoryRouter>
  </I18nextProvider>
);

describe('teacher dashboard chrome in English', () => {
  let wrapper: ReactWrapper | undefined;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('translates the sidebar', () => {
    wrapper = mount(
      wrap(<DashboardSidebar activeTab="clases" onTabChange={jest.fn()} onStartBlankClass={jest.fn()} />)
    );
    expect(wrapper.text()).toContain('TEACHER PANEL');
    expect(
      wrapper
        .find('[data-testid="dashboard-sidebar-tab-historial"]')
        .first()
        .text()
    ).toBe('History');
    expect(
      wrapper
        .find('[data-testid="dashboard-sidebar-start-class"]')
        .first()
        .text()
    ).toBe('Start class');
    const signOut = wrapper.find('button[data-testid="dashboard-sidebar-sign-out"]');
    expect(signOut.text()).toBe('Sign out');
    expect(signOut.prop('title')).toBe('Signing out is not available in this mode');
  });

  it('translates the header and mounts the language selector only when asked', () => {
    wrapper = mount(
      wrap(<DashboardHeader professorName="Ana" professorInitials="A" onLogoClick={jest.fn()} showLanguageSelector />)
    );
    expect(wrapper.find('button[aria-label="Go to home"]').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-testid="dashboard-profile-menu-item"]')
        .first()
        .text()
    ).toBe('Profile');
    expect(wrapper.find('select[aria-label="Language"]').exists()).toBe(true);
    wrapper.unmount();

    wrapper = mount(wrap(<DashboardHeader professorName="Ana" professorInitials="A" />));
    expect(wrapper.find('select').exists()).toBe(false);
  });

  it('translates the notification dropdown chrome and its error copy', () => {
    wrapper = mount(
      wrap(
        <NotificationDropdown
          notifications={[]}
          unreadCount={2}
          hasConfirmedState
          hasMore
          isLoadingMore={false}
          pendingReadId={null}
          isMarkingAll={false}
          isClearing={false}
          refreshError={new Error('x')}
          paginationError={null}
          readError={null}
          markAllError={null}
          clearError={null}
          reconcileError={null}
          onNotificationClick={jest.fn()}
          onLoadMore={jest.fn()}
          onMarkAllRead={jest.fn()}
          onClearAll={jest.fn()}
        />
      )
    );
    const text = wrapper.text();
    expect(text).toContain("You're all caught up");
    expect(text).toContain("We couldn't refresh your notifications.");
    expect(text).toContain('You have unread notifications');
    expect(text).toContain('Load more');
  });

  it('uses translated default labels in the confirm dialog', () => {
    wrapper = mount(wrap(<ConfirmDialog open title="T" message="M" onConfirm={jest.fn()} onCancel={jest.fn()} />));
    expect(
      wrapper
        .find('[data-testid="dashboard-confirm-dialog-confirm"]')
        .first()
        .text()
    ).toBe('Confirm');
    expect(
      wrapper
        .find('[data-testid="dashboard-confirm-dialog-cancel"]')
        .first()
        .text()
    ).toBe('Cancel');
  });
});

describe('CalendarTab in English', () => {
  const classRecord = (id: string, studentCount: number, hour: number): ClassRecord => ({
    id,
    title: `Class ${id}`,
    roomName: id,
    scheduledAtMs: new Date(2026, 6, 8, hour, 0).getTime(),
    studentCount,
    durationMinutes: 60,
    status: 'scheduled',
  });
  let wrapper: ReactWrapper | undefined;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 8));
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    jest.useRealTimers();
  });

  it('formats month, day and time with the English locale and pluralizes the counts', () => {
    wrapper = mount(
      wrap(
        <CalendarTab
          classes={[classRecord('a', 1, 15), classRecord('b', 12, 9)]}
          isLoading={false}
          error={null}
          onRetry={jest.fn()}
          onStartClass={jest.fn()}
          onCancelClass={jest.fn()}
        />
      )
    );
    const text = wrapper.text();
    expect(text).toContain('July 2026');
    expect(text).toContain('July 8');
    expect(text).toContain('2 classes scheduled');
    expect(text).toContain('JULY 2026 · SUMMARY');
    expect(text).toContain('1 student');
    expect(text).toContain('12 students');
    expect(text).toContain('3:00 PM');
    expect(
      wrapper
        .find('[data-testid="dashboard-calendar-day-8"]')
        .first()
        .prop('aria-label')
    ).toBe('July 8, 2026');
    expect(
      wrapper
        .find('[data-testid="dashboard-calendar-today"]')
        .first()
        .text()
    ).toBe('Today');
    expect(text).toContain('MTWTFSS');
  });

  it('translates the empty-day, loading and unavailable states', () => {
    wrapper = mount(
      wrap(<CalendarTab classes={[]} isLoading={false} error={null} onRetry={jest.fn()} onStartClass={jest.fn()} />)
    );
    expect(wrapper.text()).toContain('No classes scheduled');
    wrapper.unmount();

    wrapper = mount(
      wrap(<CalendarTab classes={null} isLoading={false} error={null} onRetry={jest.fn()} onStartClass={jest.fn()} />)
    );
    expect(wrapper.text()).toBe('The real calendar requires Firebase authentication.');
  });
});

describe('dashboard hooks in English', () => {
  const NOW = new Date('2026-07-08T15:00:00').getTime();
  const HOUR = 60 * 60 * 1000;
  const upcoming: ClassRecord = {
    id: 'c1',
    title: 'Algebra',
    roomName: 'algebra',
    scheduledAtMs: NOW + HOUR,
    studentCount: 20,
    durationMinutes: 60,
    status: 'scheduled',
  };
  const expired: ClassRecord = { ...upcoming, id: 'c2', roomName: 'old', scheduledAtMs: NOW - 5 * HOUR };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    (Date.now as jest.Mock).mockRestore();
  });

  it('useTeacherClasses builds the session labels and the date with the active language', async () => {
    const i18n = english();
    const fetchClasses = jest.fn(() => Promise.resolve([upcoming, expired]));
    const { result, waitForNextUpdate } = renderHook(
      () =>
        useTeacherClasses({
          fetchClasses,
          createClass: jest.fn(),
          deleteClass: jest.fn(),
          startClass: jest.fn(),
          professorName: 'Ana',
          onStartClass: jest.fn(),
          refreshNotifications: jest.fn(),
        }),
      { wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider> }
    );
    await waitForNextUpdate();

    expect(result.current.sessions[0].relativeLabel).toBe('In 1h');
    expect(result.current.sessions[0].time).toBe('4:00 PM');
    expect(result.current.expiredSessions[0].relativeLabel).toBe('Expired 5h ago');
    expect(result.current.dateLabel).toBe('Wednesday, July 8, 2026');
  });

  it('useTeacherReports labels the stat cards in English', () => {
    const i18n = english();
    const { result } = renderHook(
      () =>
        useTeacherReports({
          fetchAttentionReports: undefined,
          saveAttentionReport: undefined,
          userUid: undefined,
          setPendingReports: jest.fn(),
          notifications: { refresh: jest.fn() },
        }),
      { wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider> }
    );
    expect(result.current.stats.map(stat => stat.label)).toEqual([
      'Sessions this week',
      'Active students',
      'Average attention',
      'Hours taught',
    ]);
  });
});
