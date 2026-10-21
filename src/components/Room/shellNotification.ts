export type ShellNotificationEvent = 'joined' | 'left' | 'hand';

export type ShellNotification = {
  id: string;
  text: string;
  kind: 'participant' | 'local-hand';
  /** What happened; drives the pill emoji so it never depends on the translated text. */
  event?: ShellNotificationEvent;
  createdAt: number;
};
