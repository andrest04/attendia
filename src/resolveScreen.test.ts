import { resolveScreen, ScreenInputs } from './resolveScreen';

const inputs = (overrides: Partial<ScreenInputs> = {}): ScreenInputs => ({
  sessionEndedByProfessor: false,
  isProfileRoute: false,
  initialRole: 'student',
  dashboardActive: false,
  isDashboardTabRoute: false,
  roomState: 'disconnected',
  ...overrides,
});

describe('resolveScreen', () => {
  it('shows the lobby while not connected', () => {
    expect(resolveScreen(inputs())).toBe('prejoin');
  });

  it('shows the room once connected or reconnecting', () => {
    expect(resolveScreen(inputs({ roomState: 'connected' }))).toBe('room');
    expect(resolveScreen(inputs({ roomState: 'reconnecting' }))).toBe('room');
  });

  it.each([
    ['the dashboard is active', { dashboardActive: true }],
    ['the profile route is open', { isProfileRoute: true }],
    ['a dashboard tab route is open', { isDashboardTabRoute: true }],
  ])('shows the dashboard to a teacher when %s', (_, overrides) => {
    expect(resolveScreen(inputs({ initialRole: 'teacher', ...overrides }))).toBe('dashboard');
  });

  it('never shows the teacher dashboard to a student on a dashboard tab route', () => {
    expect(resolveScreen(inputs({ initialRole: 'student', isDashboardTabRoute: true }))).toBe('prejoin');
  });

  it('shows the profile alone for a student on the profile route', () => {
    expect(resolveScreen(inputs({ isProfileRoute: true, initialRole: 'student' }))).toBe('studentProfile');
  });

  it('lets a session ended for everyone trump every other screen', () => {
    [
      { dashboardActive: true },
      { isProfileRoute: true },
      { isDashboardTabRoute: true },
      { roomState: 'connected' as const },
      { roomState: 'disconnected' as const },
    ].forEach(overrides => {
      expect(resolveScreen(inputs({ sessionEndedByProfessor: true, ...overrides }))).toBe('sessionEnded');
    });
  });

  it('keeps the dashboard over the room while the dashboard is the active screen', () => {
    expect(resolveScreen(inputs({ initialRole: 'teacher', dashboardActive: true, roomState: 'connected' }))).toBe(
      'dashboard'
    );
  });

  it('keeps the lobby for a student whose profile route is not open', () => {
    expect(resolveScreen(inputs({ initialRole: 'student' }))).toBe('prejoin');
  });
});
