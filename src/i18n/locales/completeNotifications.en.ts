const completeNotifications = {
  unread: 'Unread', read: 'Read',
  upcoming: { title: 'Upcoming class', message: 'Your class starts in 15 minutes.', namedTitle: 'Upcoming class: {{name}}', namedMessage: 'Your class "{{name}}" starts in 15 minutes.' },
  notStarted: { title: 'Class not started', message: 'The scheduled class has not started yet.', namedTitle: 'Class not started: {{name}}', namedMessage: 'Your scheduled class "{{name}}" has not started yet.' },
  recordingReady: { title: 'Recording ready', message: 'The requested recording is now available.' },
  recordingFailed: { title: 'Recording processing failed', message: 'The requested recording could not be processed.' },
  reportFailed: { title: 'Report could not be saved', message: 'The report is still pending. Try again from history.' },
};
export default completeNotifications;
