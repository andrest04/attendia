const completeReports = {
  completeReports: {
    shared: {
      students_one: '{{count}} student', students_other: '{{count}} students',
      alerts_one: '{{count}} alert', alerts_other: '{{count}} alerts', mock: 'Simulated data',
    },
    report: {
      title: 'Attention Report', session: 'Session:', mock: 'Simulated data — CV pipeline pending',
      groupAverage: 'Average group attention', monitored: 'Students monitored', participants: 'participants',
      proctoring: 'Proctoring alerts', events: 'events detected', thresholdExceeded: 'Threshold exceeded',
      totalTime: 'of total time', evolution: 'Group attention over time', groupAttention: 'Group attention',
      threshold: 'Minimum threshold ({{threshold}}%)', details: 'Student details',
      name: 'Student name', average: 'Avg. index', minimum: 'Minimum', maximum: 'Maximum',
      alerts: 'Proctoring alerts', level: 'Level', high: 'High', medium: 'Medium', low: 'Low',
    },
    history: {
      back: 'Back', backToHistory: 'Back to history', title: 'Class history',
      subtitle: 'Attention reports saved at the end of each class session.',
      unavailable: 'Class history is only available to teachers.', loading: 'Loading history…',
      retry: 'Retry', failure: 'We could not load class history.',
      empty: 'There are no saved classes yet. Your attention report will appear here when you end a session.',
      noDate: 'Date unavailable', ended: 'Session ended for everyone', left: 'The teacher left without closing the room',
      average: 'Average {{value}} / 100',
    },
    reportPage: {
      title: 'Attention Report', close: 'Close', access: 'We could not verify your access to the report.',
      failure: 'We could not load the report.', loading: 'Loading the report...',
    },
    recordingPage: {
      title: 'Class recording', close: 'Close', download: 'Download',
      access: 'We could not verify your access to this recording.', failure: 'We could not load the recording.',
      downloadFailure: 'We could not download the recording.', loading: 'Loading the recording...',
    },
  },
};
export default completeReports;
