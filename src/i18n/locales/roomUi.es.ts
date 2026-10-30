// In-room UI copy (Spanish is the base language). Namespaces: room (shells, rails, roster),
// toolbar (buttons, menus, prompts) and notifications (toasts and the shell activity feed).
const roomUi = {
  room: {
    session: {
      defaultName: 'Sesión Twilio en vivo',
      noActiveParticipant: 'Sin participante activo',
    },
    connection: {
      noData: 'Sin datos',
      weak: 'Débil',
      medium: 'Media',
      good: 'Buena',
    },
    connectionQuality: {
      good: 'Conexión buena',
      medium: 'Conexión media',
      poor: 'Conexión débil',
      unknown: 'Verificando…',
    },
    participants: {
      title: 'Participantes',
      close: 'Cerrar participantes',
      inRoom_one: '{{count}} en sala',
      inRoom_other: '{{count}} en sala',
    },
    chat: {
      tab: 'Chat',
      close: 'Cerrar chat',
    },
    gallery: {
      students: 'Mostrando {{visible}} / {{total}} estudiantes',
      previous: 'Página anterior',
      next: 'Página siguiente',
      navigation: 'Navegación de páginas',
      currentPage: 'Página {{page}}',
      goToPage: 'Ir a la página {{page}}',
    },
    stage: {
      degraded: 'Resolución reducida por baja conectividad',
    },
    statusBar: {
      defaultSession: 'Sesión',
      students_one: '{{count}} estudiante',
      students_other: '{{count}} estudiantes',
      help: 'Ayuda',
    },
    hands: {
      title: 'Manos levantadas ({{count}})',
      grantTurn: 'Dar turno',
    },
    notifications: {
      title: 'Notificaciones',
      empty: 'Sin actividad por ahora.',
    },
    presence: {
      unsupported: 'No medible (celular)',
      cameraOff: 'Cámara apagada',
      pending: 'Analizando… (sin lectura aún)',
      noFace: 'Sin medición — rostro no detectado',
    },
    level: {
      high: 'Alto',
      medium: 'Medio',
      low: 'Bajo',
    },
    moderation: {
      mute: 'Silenciar',
      requestUnmute: 'Pedir activar micrófono',
      muteVideo: 'Apagar cámara',
      requestVideo: 'Sugerir cámara',
      revokeScreenShare: 'Quitar permiso de pantalla',
      allowScreenShare: 'Permitir compartir pantalla',
    },
    roster: {
      multiface: 'Múltiples rostros detectados',
      actionsFor: 'Acciones para {{name}}',
    },
    rightRail: {
      tabGroup: 'Grupo',
      tabIndividual: 'Individual',
      closePanel: 'Cerrar panel',
      groupAttention: 'Atención grupal',
      noData: 'Sin datos de atención, verifica la conexión de los estudiantes.',
      belowThreshold: 'Atención grupal por debajo del umbral ({{threshold}}%)',
      timeline: 'Evolución temporal',
      viewReport: 'Ver reporte',
    },
    liveReport: {
      title: 'Reporte de Atención',
      close: 'Cerrar',
    },
    proctoring: {
      caption: 'Proctoring',
      close: 'Cerrar',
      studentCaption: 'Estudiante · Sesión activa',
      markLegitimate: 'Marcar como legítimo',
      sendWarning: 'Enviar advertencia',
      markedLegitimate: 'Alerta de {{name}} marcada como legítima',
      warningSent: 'Advertencia enviada a {{name}}',
      feedTitle: 'Alertas de proctoring ({{count}})',
      kind: {
        multiface: 'Múltiples rostros',
        absent: 'Sin presencia',
        away: 'Distraído',
        'camera-off': 'Cámara apagada',
      },
      message: {
        'camera-off':
          '{{name}} apagó su cámara. No hay datos de atención mientras esté apagada · Detectado a las {{detectedAt}}',
        multiface: 'Se detectaron varios rostros en la cámara de {{name}} · Detectado a las {{detectedAt}}',
        away: '{{name}} apartó la mirada de la pantalla · Detectado a las {{detectedAt}}',
        absent: 'No se detecta a {{name}} frente a la cámara · Detectado a las {{detectedAt}}',
      },
    },
    onboarding: {
      dialogLabel: 'Tutorial de bienvenida',
      stepOf: 'Paso {{current}} de {{total}}',
      close: 'Cerrar tutorial',
      skip: 'Saltar tutorial',
      previous: '← Anterior',
      next: 'Siguiente →',
      start: 'Comenzar',
      manual: 'Acceder al manual completo',
      steps: {
        controls: {
          title: 'Controles de cámara y micrófono',
          body:
            'Gestiona tu cámara y micrófono desde la barra de herramientas inferior. Puedes activarlos o desactivarlos en cualquier momento durante la sesión.',
          callout: 'El área resaltada en la parte inferior es la barra de herramientas principal.',
        },
        panels: {
          title: 'Chat y participantes',
          body:
            'Abre el panel derecho con estos botones de la barra de herramientas para ver la lista de participantes y comunicarte por el chat.',
          callout: 'Los botones resaltados abren los paneles de participantes y de chat.',
        },
        attention: {
          title: 'Detección de atención',
          body:
            'El sistema analiza tu nivel de atención de forma local en tu dispositivo. Estos datos ayudan al profesor a entender el compromiso del grupo.',
          callout: 'Los datos faciales NO se almacenan ni se envían a servidores externos.',
        },
        privacy: {
          title: 'Privacidad y seguridad',
          body:
            'Toda la comunicación está cifrada con SRTP. Los tokens de sesión se generan automáticamente y expiran al cerrar la sesión.',
          callout: 'Consulta la política de privacidad desde el pie de página.',
        },
      },
    },
  },
  toolbar: {
    audio: {
      none: 'Sin audio',
      mute: 'Silenciar',
      unmute: 'Activar',
    },
    video: {
      none: 'Sin video',
      stop: 'Detener video',
      start: 'Iniciar video',
    },
    captions: {
      label: 'Subtítulos',
      ariaLabel: 'Activar o desactivar subtítulos',
      requiresTranscriptions: 'Requiere activar las transcripciones en tiempo real en la consola de Twilio',
    },
    raiseHand: {
      lowerAria: 'Bajar la mano',
      raiseAria: 'Levantar la mano',
      lower: 'Bajar mano',
      raise: 'Levantar mano',
    },
    screenShare: {
      start: 'Compartir pantalla',
      stop: 'Dejar de compartir',
      short: 'Compartir',
      blockedByOther: 'No puedes compartir pantalla mientras otro usuario lo está haciendo',
      lockedByTeacher: 'Pide permiso al profesor para compartir pantalla',
      notSupported: 'Este navegador no admite compartir pantalla',
    },
    chat: {
      label: 'Chat',
    },
    participants: 'Participantes',
    endCall: {
      leave: 'Salir',
      endSession: 'Terminar sesión',
      dialogTitle: '¿Terminar la sesión?',
      dialogBody:
        'Puedes salir tú solo y dejar la clase abierta para que los estudiantes continúen, o terminar la sesión para todos y cerrar la sala.',
      cancel: 'Cancelar',
      leaveOnly: 'Salir sin cerrar',
      endForAll: 'Terminar para todos',
      ending: 'Terminando…',
    },
    deviceMenu: {
      microphone: 'Micrófono',
      speaker: 'Parlante',
      camera: 'Cámara',
      systemMicrophone: 'Micrófono del sistema',
      systemAudioOutput: 'Salida de audio del sistema',
      systemCamera: 'Cámara del sistema',
      chooseAudio: 'Elegir micrófono o parlante',
      chooseCamera: 'Elegir cámara',
    },
    menuBar: {
      sharingBanner: 'Estás compartiendo tu pantalla',
      participants_one: '{{count}} participante',
      participants_other: '{{count}} participantes',
    },
    menu: {
      more: 'Más',
      audioVideoSettings: 'Configuración de audio y video',
      backgrounds: 'Fondos',
      flipCamera: 'Girar cámara',
      stopRecording: 'Detener grabación',
      startRecording: 'Iniciar grabación',
      roomMonitor: 'Monitor de sala',
      speakerView: 'Vista de orador',
      galleryView: 'Vista de galería',
      about: 'Acerca de',
    },
    overflow: {
      more: 'Más',
    },
    professor: {
      hideAttention: 'Ocultar atención',
      attentionPanel: 'Panel de atención',
      record: 'Grabar',
      proctoringActive: 'Proctoring activo',
      proctoring: 'Proctoring',
    },
    unmuteRequest: {
      mic: 'El profesor te pide activar tu micrófono',
      camera: 'El profesor te sugiere encender tu cámara',
      notNow: 'Ahora no',
      enable: 'Activar',
    },
  },
  notifications: {
    participantJoined: '{{name}} se unió a la sesión',
    participantLeft: '{{name}} salió de la sesión',
    handRaised: '{{name}} levantó la mano',
    professorJoined: 'El profesor se unió a la sesión',
    professorLeft: 'El profesor salió de la sesión',
    mutedByProfessor: 'El profesor silenció tu micrófono',
    cameraOffByProfessor: 'El profesor apagó tu cámara',
    recordingStarted: 'La sesión se está grabando',
    recordingStopped: 'Se detuvo la grabación',
    turnGranted: 'Es tu turno · el profesor te dio la palabra',
    endSessionFailed: 'No se pudo cerrar la sala en el servidor. Los estudiantes podrían seguir conectados.',
    warning: {
      multiface: 'El profesor detectó varias personas en tu cámara',
      absent: 'El profesor no te detecta frente a la cámara',
      away: 'El profesor te pidió volver a concentrarte en la clase',
      'camera-off': 'El profesor te pidió encender tu cámara',
      generic: 'El profesor te envió una advertencia',
    },
  },
};

export default roomUi;
