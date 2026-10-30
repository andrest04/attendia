const completeNotifications = {
  unread: 'No leída', read: 'Leída',
  upcoming: { title: 'Clase próxima', message: 'Tu clase comienza en 15 minutos.', namedTitle: 'Clase próxima: {{name}}', namedMessage: 'Tu clase "{{name}}" comienza en 15 minutos.' },
  notStarted: { title: 'Clase no iniciada', message: 'La clase programada todavía no fue iniciada.', namedTitle: 'Clase no iniciada: {{name}}', namedMessage: 'Tu clase "{{name}}" programada todavía no fue iniciada.' },
  recordingReady: { title: 'Grabación lista', message: 'La grabación solicitada ya está disponible.' },
  recordingFailed: { title: 'Error al procesar la grabación', message: 'No se pudo procesar la grabación solicitada.' },
  reportFailed: { title: 'No se pudo guardar el reporte', message: 'El reporte sigue pendiente. Volvé a intentarlo desde el historial.' },
};
export default completeNotifications;
