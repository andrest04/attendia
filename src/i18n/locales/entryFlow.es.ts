// Entry flow, auth, errors, chat and miscellaneous screens (Spanish is the base language).
// Namespaces: prejoin (lobby, device check, consent, media errors, intro shell), auth (login,
// registration, create password), errors (error dialog and client-side failures), chat and
// misc (about dialog, blocked/ended/unsupported screens, participant tile labels).
const entryFlow = {
  prejoin: {
    reconnecting: 'Reconectando a la sala…',
    roomLabel: 'Sala:',
    intro: {
      classLabel: 'Clase:',
      preSession: 'Pre-sesión',
      createPassword: 'Crear contraseña',
      signOut: 'Cerrar sesión',
      badge: 'Plataforma de Videoconferencia',
      welcome: 'Bienvenido a',
      tagline: 'Videoconferencia síncrona para aulas híbridas con detección de atención en tiempo real.',
      backToDashboard: '← Volver al panel',
      infrastructure: 'Infraestructura',
      security: 'Seguridad y Privacidad',
    },
    roomName: {
      checking: 'Verificando sala…',
      switchToStudent: 'Unirse como estudiante',
      switchToTeacher: 'Volver a crear sesión',
      teacher: {
        title: 'Profesor',
        subtitle: 'Crear nueva sala de clase',
        badge: 'Gestión de Sala',
        roomNameLabel: 'Nombre de la sala',
        roomNamePlaceholder: 'Ej: Matemáticas — Grupo A',
        yourName: 'Tu nombre',
        created: 'Sesión creada',
        shareHint: 'Comparte el código o el link con tus estudiantes.',
        visibleIdentity: 'Identidad visible en sala',
        copied: 'Copiado',
        copy: 'Copiar',
        openNotice: 'Esa sala ya está abierta ({{name}}). ¿Quieres entrar?',
        openNoticeJoin: 'Sí, entrar a la sala',
        creating: 'Creando sala…',
        create: 'Crear sala →',
        continueToCheck: 'Continuar a verificación',
      },
      joinBox: {
        title: '¿Ya hay una sala abierta?',
        helper: 'Ingresa el código o el enlace para entrar a ella.',
        placeholder: 'Código o enlace de sala',
        enter: 'Entrar a la sala',
        inconclusive: 'No pudimos verificar si la sala está abierta. Revisa tu conexión e inténtalo de nuevo.',
        closed:
          'La sala {{name}} no está abierta. Revisa que el código esté bien escrito o crea una sala con ese nombre.',
        createWithName: 'Crear con este nombre',
        confirmCreate: '¿Crear una sala nueva llamada {{name}}?',
        confirmYes: 'Sí, crear sala',
        cancel: 'Cancelar',
      },
      student: {
        title: 'Estudiante',
        subtitle: 'Unirme a sala existente',
        badge: 'Acceso de Estudiante',
        codeLabel: 'Código o enlace de sala',
        codePlaceholder: 'Ingresar código de sesión',
        nameLabel: 'Tu nombre o alias',
        namePlaceholder: 'Ej: Ana García',
        nameHelper: 'Te unirás con tu cuenta.',
        privacyTitle: 'Aviso de privacidad',
        privacyBody:
          'Al unirte aceptas el procesamiento {{local}} de imagen para análisis de atención. No se almacenan datos faciales.',
        privacyLocal: 'local',
        roomClosed: 'La sala todavía no está abierta. Pedile al docente que inicie la sesión antes de entrar.',
        join: 'Unirme a la sala →',
      },
    },
    device: {
      joining: 'Uniéndose a la reunión',
      title: 'Sala de Espera',
      subtitle: 'Verifica tus dispositivos antes de entrar · Clase:',
      panelTitle: 'Verificación previa',
      connectionLabel: 'Calidad de conexión',
      devicesLabel: 'Estado de dispositivos',
      enter: 'Entrar a la sala →',
      cancel: 'Cancelar',
      preview: {
        title: 'Twilio Video · Vista previa',
        cameraOff: 'Cámara apagada',
      },
      settings: {
        more: 'Más',
        settings: 'Configuración',
        about: 'Acerca de',
        audioVideo: 'Configuración de audio y video',
        connection: 'Configuración de conexión',
      },
      connection: {
        good: 'Conexión buena',
        medium: 'Conexión media',
        poor: 'Conexión pobre',
        unknown: 'Verificando…',
      },
      checks: {
        micOk: 'Micrófono detectado',
        micMissing: 'Micrófono no detectado',
        cameraOk: 'Cámara detectada',
        cameraMissing: 'Cámara no detectada',
        speakersOk: 'Altavoces funcionando',
        speakersMissing: 'Altavoces no detectados',
        lightingCameraOff: 'Iluminación (cámara apagada)',
        lightingCameraBlocked: 'Iluminación (cámara bloqueada)',
        lightingLow: 'Iluminación insuficiente',
        lightingOk: 'Iluminación adecuada',
      },
      lighting: {
        bannerLabel: 'Verificación de iluminación',
        title: 'Condiciones de iluminación insuficientes para análisis de atención',
        hint: 'Mejora la iluminación de tu entorno para que el sistema pueda analizar tu atención correctamente.',
        close: 'Cerrar aviso',
      },
      noise: {
        title: 'Cancelación de ruido',
        tooltip: 'Suprime el ruido de fondo de tu micrófono',
        on: 'Activado',
        off: 'Desactivado',
      },
      privacy: {
        title: 'Privacidad de datos faciales',
        text: 'El análisis de atención se procesa {{local}}. No se almacenan datos faciales.',
        local: 'localmente',
        link: 'Política de privacidad →',
      },
    },
    consent: {
      title: 'Análisis de atención en clase',
      intro:
        'Esta sesión utiliza análisis de atención basado en visión por computadora. Antes de unirte, necesitamos tu consentimiento explícito.',
      whatTitle: '¿Qué analiza el sistema?',
      whatGaze: 'Detección de mirada (ojos) y orientación de la cabeza',
      whatIndex: 'Generación de un índice numérico de atención (0–100)',
      protectTitle: '¿Cómo se protegen tus datos?',
      protectBefore: 'Todo el procesamiento ocurre ',
      protectStrong: 'en tu dispositivo',
      protectAfter: ' (on-device)',
      protectNoImages: 'Ninguna imagen ni video sale de tu equipo',
      protectOnlyIndices: 'Solo se transmiten índices numéricos de atención al docente',
      protectPedagogical: 'Los datos son para uso pedagógico exclusivamente',
      policyIntro: 'Puedes consultar nuestra',
      policyLink: 'Política de privacidad →',
      alternative:
        'Si prefieres no participar en el análisis automatizado, existe una alternativa presencial. Consulta a tu docente antes de unirte.',
      back: 'Volver',
      accept: 'Aceptar y unirme',
    },
    mediaError: {
      noAccess: { headline: 'No se puede acceder a los medios:' },
      cameraDenied:
        'El usuario denegó el permiso para usar el video. Por favor, concede acceso a la cámara en el navegador.',
      microphoneDenied:
        'El usuario denegó el permiso para usar el audio. Por favor, concede acceso al micrófono en el navegador.',
      systemBlocked:
        'El sistema operativo bloqueó el acceso del navegador al micrófono o la cámara. Verifica la configuración de privacidad del sistema.',
      bothDenied:
        'El usuario denegó el permiso para usar el audio y el video. Por favor, concede acceso al micrófono y la cámara en el navegador.',
      notFound: {
        headline: 'No se encontró micrófono ni cámara:',
        message:
          'El navegador no puede acceder al micrófono o la cámara. Asegúrate de que los dispositivos estén conectados y habilitados.',
      },
      inUse: {
        headline: 'No se puede usar la cámara o el micrófono:',
        message:
          'Otra aplicación (por ejemplo Zoom, Teams o Meet) podría estar usando tu cámara o micrófono. Ciérrala o cierra las otras pestañas que los usen y vuelve a intentarlo.',
      },
      overconstrained: {
        headline: 'No se puede usar la cámara seleccionada:',
        message:
          'La cámara seleccionada ya no está disponible. Selecciona otra cámara en la lista o reconecta el dispositivo e inténtalo de nuevo.',
      },
      generic: {
        headline: 'No se pudo acceder a la cámara o el micrófono:',
        message:
          'Ocurrió un problema al acceder a tus dispositivos. Revisa que la cámara y el micrófono estén conectados y disponibles, y vuelve a intentarlo.',
      },
      noDevices: {
        headline: 'No se detectó cámara ni micrófono:',
        message: 'Los demás participantes no podrán verte ni escucharte.',
      },
      noCamera: {
        headline: 'No se detectó cámara:',
        message: 'Los demás participantes no podrán verte.',
      },
      noMicrophone: {
        headline: 'No se detectó micrófono:',
        message: 'Los demás participantes no podrán escucharte.',
      },
    },
  },
  auth: {
    errors: {
      invalidCredentials: 'Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo.',
      emailInUse: 'Ya existe una cuenta con este correo. Inicia sesión para continuar.',
      weakPassword: 'La contraseña es demasiado débil. Usa al menos 6 caracteres.',
      invalidEmail: 'El correo electrónico no es válido.',
      tooManyRequests: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
      generic: 'No pudimos completar la operación. Intenta de nuevo en unos segundos.',
    },
    roles: {
      teacher: { label: 'Soy profesor', caption: 'Crear y dar clases' },
      student: { label: 'Soy estudiante', caption: 'Unirme a clases existentes' },
    },
    fields: {
      email: 'Correo electrónico',
      password: 'Contraseña',
      fullName: 'Nombre completo',
    },
    completion: {
      title: '¿Cómo vas a usar Attendia?',
      subtitle: 'Selecciona tu rol para terminar de configurar tu cuenta.',
      signedInAs: 'Conectado como {{account}}',
      confirm: 'Confirmar y continuar',
      cancelLabel: 'Cancelar la configuración y cerrar sesión',
      cancel: 'Cancelar y cerrar sesión',
    },
    login: {
      title: 'Iniciar sesión',
      subtitle: 'Accede con tu cuenta para entrar a tus clases.',
      submit: 'Iniciar sesión',
      or: 'o',
      google: 'Continuar con Google',
      noAccount: '¿No tienes cuenta?',
      createAccount: 'Crear cuenta',
    },
    register: {
      title: 'Crear cuenta',
      subtitle: 'Regístrate para crear o unirte a clases en Attendia.',
      submit: 'Crear cuenta',
      haveAccount: '¿Ya tienes cuenta?',
      signIn: 'Iniciar sesión',
    },
    securityLink: 'Seguridad y Privacidad',
    createPassword: {
      title: 'Crear contraseña',
      weak: 'La contraseña es demasiado débil. Usa al menos {{min}} caracteres.',
      requiresRecentLogin: 'Por seguridad, cierra sesión y vuelve a entrar con Google antes de crear tu contraseña.',
      alreadyLinked: 'Esta cuenta ya tiene una contraseña configurada. Inicia sesión con tu correo y contraseña.',
      generic: 'No se pudo crear la contraseña. Intenta de nuevo.',
      mismatch: 'Las contraseñas no coinciden.',
      success: 'Contraseña creada. Ya puedes iniciar sesión con tu correo y contraseña.',
      understood: 'Entendido',
      newPassword: 'Contraseña nueva',
      confirmPassword: 'Confirmar contraseña',
      cancel: 'Cancelar',
      submit: 'Crear contraseña',
    },
  },
  errors: {
    dialog: {
      title: 'ERROR',
      errorCode: 'Código de error: {{code}}',
    },
    enhanced: {
      invalidToken: 'No se pudo validar la sesión. Verifica que las credenciales sean correctas.',
      screenShareSystemDenied:
        'No se puede compartir la pantalla. Verifica que el sistema operativo tenga habilitados los permisos para compartir pantalla.',
      permissionDenied:
        'El navegador bloqueó el acceso a la cámara o el micrófono. Haz clic en el ícono de la cámara (a la izquierda de la barra de direcciones), permite el acceso y vuelve a intentar.',
      deviceInUse:
        'No se pudo iniciar la cámara. Cierra otras apps o pestañas que la estén usando y vuelve a intentar.',
      deviceNotFound: 'No se encontró una cámara o un micrófono. Conecta un dispositivo y vuelve a intentar.',
    },
    roomOwnerLookupFailed: 'No pudimos verificar tu rol en la sala.',
    auth: {
      uploadFailed: 'No pudimos subir el archivo. Intenta de nuevo en unos segundos.',
      noSessionToConfirm: 'No hay una sesión activa para confirmar tu identidad.',
      currentPasswordRequired: 'Ingresa tu contraseña actual para continuar.',
      noSession: 'No hay una sesión activa.',
      renameRollbackFailed:
        'No pudimos guardar el nombre ni restaurar tu identidad. Reintenta el cambio para reconciliarla.',
    },
  },
  chat: {
    title: 'Chat',
    unavailable: 'El chat no está disponible en esta sesión.',
    connecting: 'Conectando chat...',
    placeholder: 'Escribe un mensaje...',
    inputLabel: 'Mensaje de chat',
    clickToOpen: 'Haz clic para abrir',
    newMessages_one: '{{count}} mensaje nuevo',
    newMessages_other: '{{count}} mensajes nuevos',
    error: 'Error',
    fileError: {
      tooLarge: 'El archivo es demasiado grande. El tamaño máximo es 150 MB.',
      generic: 'Hubo un problema al subir el archivo. Inténtalo de nuevo.',
    },
  },
  misc: {
    about: {
      title: 'Acerca de',
      supportedBrowser: 'Navegador compatible',
      sdkVersion: 'Versión del SDK',
      appVersion: 'Versión de la app',
      deployedTag: 'Tag desplegado',
      deployedCommit: 'Hash del commit desplegado',
      roomType: 'Tipo de sala',
    },
    phoneBlocked: {
      title: 'Esta plataforma no está disponible en celulares',
      hint: 'Ingresa desde un computador o tablet.',
    },
    sessionEnded: {
      title: 'La sesión finalizó',
      subtitle: 'El docente terminó la clase. Gracias por participar.',
      home: 'Volver al inicio',
    },
    unsupportedBrowser: {
      title: 'Navegador o contexto no compatible',
      openIn: 'Abre esta aplicación en uno de los',
      supportedBrowsers: 'navegadores compatibles',
      afterLink: '.',
      secureIntro: 'Si ya usas un navegador compatible, comprueba que la app se sirva desde un',
      secureContext: 'contexto seguro',
      secureExample: '(por ejemplo, https o localhost).',
    },
    tile: {
      reconnecting: 'Reconectando...',
      handRaised: 'Mano levantada',
      multiface: 'Multi-rostro',
      localSuffix: '(Yo)',
      screenSuffix: '- Pantalla',
      recording: 'Grabando',
      recordingTooltip:
        'Se está grabando el audio y el video de todos los participantes. Visita la configuración de la app para detener la grabación.',
      participantReconnecting: 'El participante se está reconectando',
      participantConnected: 'El participante está conectado',
    },
  },
};

export default entryFlow;
