// In-room UI copy in English. Same structure as roomUi.es.ts (a parity test enforces it).
const roomUi = {
  room: {
    session: {
      defaultName: 'Live Twilio session',
      noActiveParticipant: 'No active participant',
    },
    connection: {
      noData: 'No data',
      weak: 'Weak',
      medium: 'Fair',
      good: 'Good',
    },
    connectionQuality: {
      good: 'Good connection',
      medium: 'Fair connection',
      poor: 'Weak connection',
      unknown: 'Checking…',
    },
    participants: {
      title: 'Participants',
      close: 'Close participants',
      inRoom_one: '{{count}} in the room',
      inRoom_other: '{{count}} in the room',
    },
    chat: {
      tab: 'Chat',
      close: 'Close chat',
    },
    gallery: {
      students: 'Showing {{visible}} / {{total}} students',
      previous: 'Previous page',
      next: 'Next page',
      navigation: 'Page navigation',
      currentPage: 'Page {{page}}',
      goToPage: 'Go to page {{page}}',
    },
    stage: {
      degraded: 'Resolution reduced due to poor connectivity',
    },
    statusBar: {
      defaultSession: 'Session',
      students_one: '{{count}} student',
      students_other: '{{count}} students',
      help: 'Help',
    },
    hands: {
      title: 'Raised hands ({{count}})',
      grantTurn: 'Give turn',
    },
    notifications: {
      title: 'Notifications',
      empty: 'No activity for now.',
    },
    presence: {
      unsupported: 'Not measurable (phone)',
      cameraOff: 'Camera off',
      pending: 'Analyzing… (no reading yet)',
      noFace: 'No measurement — face not detected',
    },
    level: {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    },
    moderation: {
      mute: 'Mute',
      requestUnmute: 'Ask to turn on microphone',
      muteVideo: 'Turn off camera',
      requestVideo: 'Suggest camera',
      revokeScreenShare: 'Revoke screen sharing',
      allowScreenShare: 'Allow screen sharing',
    },
    roster: {
      multiface: 'Multiple faces detected',
      actionsFor: 'Actions for {{name}}',
    },
    rightRail: {
      tabGroup: 'Group',
      tabIndividual: 'Individual',
      closePanel: 'Close panel',
      groupAttention: 'Group attention',
      noData: 'No attention data, check the students’ connection.',
      belowThreshold: 'Group attention below the threshold ({{threshold}}%)',
      timeline: 'Timeline',
      viewReport: 'View report',
    },
    liveReport: {
      title: 'Attention Report',
      close: 'Close',
    },
    proctoring: {
      caption: 'Proctoring',
      close: 'Close',
      studentCaption: 'Student · Active session',
      markLegitimate: 'Mark as legitimate',
      sendWarning: 'Send warning',
      markedLegitimate: '{{name}}’s alert marked as legitimate',
      warningSent: 'Warning sent to {{name}}',
      feedTitle: 'Proctoring alerts ({{count}})',
      kind: {
        multiface: 'Multiple faces',
        absent: 'Not present',
        away: 'Distracted',
        'camera-off': 'Camera off',
      },
      message: {
        'camera-off':
          '{{name}} turned off their camera. There is no attention data while it is off · Detected at {{detectedAt}}',
        multiface: 'Multiple faces were detected on {{name}}’s camera · Detected at {{detectedAt}}',
        away: '{{name}} looked away from the screen · Detected at {{detectedAt}}',
        absent: '{{name}} is not detected in front of the camera · Detected at {{detectedAt}}',
      },
    },
    onboarding: {
      dialogLabel: 'Welcome tutorial',
      stepOf: 'Step {{current}} of {{total}}',
      close: 'Close tutorial',
      skip: 'Skip tutorial',
      previous: '← Previous',
      next: 'Next →',
      start: 'Get started',
      manual: 'Open the full manual',
      steps: {
        controls: {
          title: 'Camera and microphone controls',
          body:
            'Manage your camera and microphone from the toolbar at the bottom. You can turn them on or off at any time during the session.',
          callout: 'The highlighted area at the bottom is the main toolbar.',
        },
        panels: {
          title: 'Chat and participants',
          body: 'Open the right panel with these toolbar buttons to see the list of participants and talk in the chat.',
          callout: 'The highlighted buttons open the participants and chat panels.',
        },
        attention: {
          title: 'Attention detection',
          body:
            'The system analyzes your attention level locally on your device. This data helps the professor understand how engaged the group is.',
          callout: 'Facial data is NOT stored or sent to external servers.',
        },
        privacy: {
          title: 'Privacy and security',
          body:
            'All communication is encrypted with SRTP. Session tokens are generated automatically and expire when the session ends.',
          callout: 'See the privacy policy in the page footer.',
        },
      },
    },
  },
  toolbar: {
    audio: {
      none: 'No audio',
      mute: 'Mute',
      unmute: 'Unmute',
    },
    video: {
      none: 'No video',
      stop: 'Stop video',
      start: 'Start video',
    },
    captions: {
      label: 'Captions',
      ariaLabel: 'Toggle Captions',
      requiresTranscriptions: 'Requires Real-Time Transcriptions to be enabled in the Twilio Console',
    },
    raiseHand: {
      lowerAria: 'Lower your hand',
      raiseAria: 'Raise your hand',
      lower: 'Lower hand',
      raise: 'Raise hand',
    },
    screenShare: {
      start: 'Share screen',
      stop: 'Stop sharing',
      short: 'Share',
      blockedByOther: 'You cannot share your screen while another user is sharing',
      lockedByTeacher: 'Ask the professor for permission to share your screen',
      notSupported: 'This browser does not support screen sharing',
    },
    chat: {
      label: 'Chat',
    },
    participants: 'Participants',
    endCall: {
      leave: 'Leave',
      endSession: 'End session',
      dialogTitle: 'End the session?',
      dialogBody:
        'You can leave on your own and keep the class open so students can continue, or end the session for everyone and close the room.',
      cancel: 'Cancel',
      leaveOnly: 'Leave without closing',
      endForAll: 'End for everyone',
      ending: 'Ending…',
    },
    deviceMenu: {
      microphone: 'Microphone',
      speaker: 'Speaker',
      camera: 'Camera',
      systemMicrophone: 'System microphone',
      systemAudioOutput: 'System audio output',
      systemCamera: 'System camera',
      chooseAudio: 'Choose microphone or speaker',
      chooseCamera: 'Choose camera',
    },
    menuBar: {
      sharingBanner: 'You are sharing your screen',
      participants_one: '{{count}} participant',
      participants_other: '{{count}} participants',
    },
    menu: {
      more: 'More',
      audioVideoSettings: 'Audio and video settings',
      backgrounds: 'Backgrounds',
      flipCamera: 'Flip camera',
      stopRecording: 'Stop recording',
      startRecording: 'Start recording',
      roomMonitor: 'Room monitor',
      speakerView: 'Speaker view',
      galleryView: 'Gallery view',
      about: 'About',
    },
    overflow: {
      more: 'More',
    },
    professor: {
      hideAttention: 'Hide attention',
      attentionPanel: 'Attention panel',
      record: 'Record',
      proctoringActive: 'Proctoring on',
      proctoring: 'Proctoring',
    },
    unmuteRequest: {
      mic: 'The professor asks you to turn on your microphone',
      camera: 'The professor suggests you turn on your camera',
      notNow: 'Not now',
      enable: 'Turn on',
    },
  },
  notifications: {
    participantJoined: '{{name}} joined the session',
    participantLeft: '{{name}} left the session',
    handRaised: '{{name}} raised their hand',
    professorJoined: 'The professor joined the session',
    professorLeft: 'The professor left the session',
    mutedByProfessor: 'The professor muted your microphone',
    cameraOffByProfessor: 'The professor turned off your camera',
    recordingStarted: 'The session is being recorded',
    recordingStopped: 'Recording stopped',
    turnGranted: 'It’s your turn · the professor gave you the floor',
    endSessionFailed: 'The room could not be closed on the server. Students may still be connected.',
    warning: {
      multiface: 'The professor detected several people on your camera',
      absent: 'The professor cannot detect you in front of the camera',
      away: 'The professor asked you to refocus on the class',
      'camera-off': 'The professor asked you to turn on your camera',
      generic: 'The professor sent you a warning',
    },
  },
};

export default roomUi;
