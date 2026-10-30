const completeReports = {
  completeReports: {
    shared: {
      students_one: '{{count}} estudiante', students_other: '{{count}} estudiantes',
      alerts_one: '{{count}} alerta', alerts_other: '{{count}} alertas',
      mock: 'Datos simulados',
    },
    report: {
      title: 'Reporte de Atención', session: 'Sesión:', mock: 'Datos simulados — procesamiento de visión por computadora pendiente',
      groupAverage: 'Atención promedio grupal', monitored: 'Estudiantes monitoreados', participants: 'participantes',
      proctoring: 'Alertas de supervisión', events: 'eventos detectados', thresholdExceeded: 'Umbral superado',
      totalTime: 'del tiempo total', evolution: 'Evolución de atención grupal', groupAttention: 'Atención grupo',
      threshold: 'Umbral mínimo ({{threshold}}%)', details: 'Detalle por estudiante',
      name: 'Nombre del Estudiante', average: 'Índice Prom.', minimum: 'Mínimo', maximum: 'Máximo',
      alerts: 'Alertas de supervisión', level: 'Nivel', high: 'Alto', medium: 'Medio', low: 'Bajo',
    },
    history: {
      back: 'Volver', backToHistory: 'Volver al historial', title: 'Historial de clases',
      subtitle: 'Reportes de atención guardados al finalizar cada sesión de clase.',
      unavailable: 'El historial de clases solo está disponible para profesores.', loading: 'Cargando el historial…',
      retry: 'Reintentar', failure: 'No pudimos consultar el historial de clases.',
      empty: 'Todavía no hay clases guardadas. Cuando termines una sesión, tu reporte de atención va a aparecer acá.',
      noDate: 'Fecha no disponible', ended: 'Sesión finalizada para todos', left: 'El profesor salió sin cerrar la sala',
      average: 'Promedio {{value}} / 100',
    },
    reportPage: {
      title: 'Reporte de Atención', close: 'Cerrar', access: 'No pudimos validar tu acceso al reporte.',
      failure: 'No pudimos consultar el reporte.', loading: 'Cargando el reporte...',
    },
    recordingPage: {
      title: 'Grabación de la clase', close: 'Cerrar', download: 'Descargar',
      access: 'No pudimos validar tu acceso a esta grabación.', failure: 'No pudimos cargar la grabación.',
      downloadFailure: 'No pudimos descargar la grabación.', loading: 'Cargando la grabación...',
    },
  },
};
export default completeReports;
