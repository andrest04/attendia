export type ShellNotification = {
  id: string;
  text: string;
  kind: 'participant' | 'local-hand';
  createdAt: number;
};
