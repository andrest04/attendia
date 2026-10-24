import { resolveLocale } from './locale';

/**
 * English `explanation` text keyed by the Spanish string the handlers already pass to sendError.
 * Keys must match those literals exactly. A missing key stays Spanish (S7).
 */
export const EN_EXPLANATION: { [spanish: string]: string } = {
  'Los datos enviados son demasiado grandes para que el servidor los procese.':
    'The data sent is too large for the server to process.',
  'La sala todavía no está abierta. Pedile al docente que inicie la sesión antes de entrar.':
    'The room is not open yet. Ask the teacher to start the session before joining.',
  'Solo una cuenta de docente puede entrar a la sala como profesor.':
    'Only a teacher account can join the room as a teacher.',
  'Falta el nombre de la sala.': 'The room name is missing.',
  'Ya hay una clase en curso con ese nombre a cargo de otro docente. Elegí otro nombre para tu sesión.':
    'Another teacher already has a class in progress with that name. Choose another name for your session.',
  'No pudimos verificar la sala. Intenta de nuevo en unos segundos.':
    "We couldn't verify the room. Try again in a few seconds.",
  'No se pudieron vaciar las notificaciones.': "The notifications couldn't be cleared.",
  'No se pudieron marcar las notificaciones como leídas.': "The notifications couldn't be marked as read.",
  'No se pudo marcar la notificación como leída.': "The notification couldn't be marked as read.",
  'No se pudieron cargar las notificaciones.': "The notifications couldn't be loaded.",
  'La clave de idempotencia no es válida.': 'The idempotency key is not valid.',
  'La notificación no es válida.': 'The notification is not valid.',
  'El cursor de notificaciones no es válido.': 'The notification cursor is not valid.',
  'La bandeja cambió; actualizá la primera página.': 'The inbox changed; refresh the first page.',
  'No pudimos consultar los recursos de la clase. Intenta de nuevo en unos segundos.':
    "We couldn't load the class resources. Try again in a few seconds.",
  'No pudimos subir el archivo. Intenta de nuevo en unos segundos.':
    "We couldn't upload the file. Try again in a few seconds.",
  'No pudimos preparar la descarga. Intenta de nuevo en unos segundos.':
    "We couldn't prepare the download. Try again in a few seconds.",
  'No pudimos preparar la vista previa. Intenta de nuevo en unos segundos.':
    "We couldn't prepare the preview. Try again in a few seconds.",
  'No pudimos eliminar el recurso. Intenta de nuevo en unos segundos.':
    "We couldn't delete the resource. Try again in a few seconds.",
  'El archivo supera el tamaño máximo permitido (25 MB).': 'The file exceeds the maximum allowed size (25 MB).',
  'Debes seleccionar un archivo para subir.': 'Select a file to upload.',
  'Solo se admiten PDFs, presentaciones (PPTX/ODP), documentos de Word (DOCX/ODT), archivos comprimidos (ZIP) y videos.':
    'Only PDFs, presentations (PPTX/ODP), Word documents (DOCX/ODT), ZIP archives, and videos are accepted.',
  'Debes seleccionar una clase programada para el archivo.': 'Select a scheduled class for the file.',
  'La clase seleccionada no existe o no te pertenece.': 'The selected class does not exist or is not yours.',
  'Este tipo de archivo no admite vista previa.': 'This file type cannot be previewed.',
  'Este archivo no admite vista previa.': 'This file cannot be previewed.',
  'Sube un solo archivo por vez.': 'Upload one file at a time.',
  'El recurso solicitado no existe.': 'The requested resource does not exist.',
  'Solo el docente puede consultar esta información.': 'Only the teacher can view this information.',
  'No pudimos verificar tu rol en la sala.': "We couldn't verify your role in the room.",
  'Esta plataforma no está disponible en celulares. Ingresa desde un computador o tablet.':
    'This platform is not available on phones. Open it from a computer or tablet.',
  'La foto supera el tamaño máximo permitido (2 MB).': 'The photo exceeds the maximum allowed size (2 MB).',
  'Debes seleccionar una imagen para subir.': 'Select an image to upload.',
  'La foto debe ser una imagen JPEG o WebP.': 'The photo must be a JPEG or WebP image.',
  'Sube una sola foto por vez.': 'Upload one photo at a time.',
  'Todavía no existe un perfil para esta cuenta.': 'There is no profile for this account yet.',
  'No pudimos consultar tu perfil. Intenta de nuevo en unos segundos.':
    "We couldn't load your profile. Try again in a few seconds.",
  'No pudimos guardar tu perfil. Intenta de nuevo en unos segundos.':
    "We couldn't save your profile. Try again in a few seconds.",
  'No tienes permiso para modificar este perfil.': 'You do not have permission to edit this profile.',
  'No pudimos actualizar tu perfil. Intenta de nuevo.': "We couldn't update your profile. Try again.",
  'No pudimos subir la foto. Intenta de nuevo en unos segundos.':
    "We couldn't upload the photo. Try again in a few seconds.",
  'No pudimos eliminar la foto. Intenta de nuevo en unos segundos.':
    "We couldn't delete the photo. Try again in a few seconds.",
  'No pudimos guardar el avance de la clase. Intenta de nuevo en unos segundos.':
    "We couldn't save the class progress. Try again in a few seconds.",
  'No pudimos recuperar el avance de la clase. Intenta de nuevo en unos segundos.':
    "We couldn't load the class progress. Try again in a few seconds.",
  'El identificador de la sala no es válido.': 'The room identifier is not valid.',
  'El identificador de la sala no coincide.': 'The room identifier does not match.',
  'No encontramos esa sesión de clase.': "We couldn't find that class session.",
  'Este reporte corresponde a una clase que no está a tu cargo.': 'This report belongs to a class you do not own.',
  'La clase ya fue cerrada para todos.': 'The class has already been ended for everyone.',
  'No encontramos avance guardado de esta clase.': "We couldn't find saved progress for this class.",
  'Solo el docente puede cambiar la grabación de la clase.': 'Only the teacher can change the class recording.',
  'Falta el identificador de la sala.': 'The room identifier is missing.',
  'Solo el docente a cargo o un co-docente de esta clase puede cambiar su grabación.':
    'Only the teacher in charge or a co-teacher of this class can change its recording.',
  'No pudimos solicitar la grabación. Intenta de nuevo en unos segundos.':
    "We couldn't request the recording. Try again in a few seconds.",
  'No pudimos consultar el estado de la grabación. Intenta de nuevo en unos segundos.':
    "We couldn't check the recording status. Try again in a few seconds.",
  'No pudimos preparar la descarga de la grabación. Intenta de nuevo en unos segundos.':
    "We couldn't prepare the recording download. Try again in a few seconds.",
  'El identificador de la solicitud no es válido.': 'The request identifier is not valid.',
  'Esta clase no tenía la grabación activa al finalizar, así que no hay nada que solicitar.':
    'Recording was not active when this class ended, so there is nothing to request.',
  'La grabación todavía no está lista para descargar.': 'The recording is not ready to download yet.',
  'No encontramos ese reporte.': "We couldn't find that report.",
  'No podemos solicitar la grabación: esta clase no está registrada a tu nombre.':
    "We can't request the recording: this class is not registered to you.",
  'La descarga de grabaciones no está configurada en el servidor.':
    'Recording downloads are not configured on the server.',
  'El enlace de descarga ya no es válido. Solicitalo de nuevo.':
    'The download link is no longer valid. Request it again.',
  'No pudimos descargar la grabación. Intenta de nuevo en unos segundos.':
    "We couldn't download the recording. Try again in a few seconds.",
  'El nombre de la sala no puede estar vacío.': 'The room name cannot be empty.',
  'El motivo de cierre de la sesión no es válido.': 'The session end reason is not valid.',
  'La línea de tiempo del reporte no es válida.': 'The report timeline is not valid.',
  'El detalle de estudiantes no es válido.': 'The student details are not valid.',
  'Las alertas del reporte no son válidas.': 'The report alerts are not valid.',
  'Las métricas del reporte no son válidas.': 'The report metrics are not valid.',
  'La duración del reporte no es válida.': 'The report duration is not valid.',
  'Las fechas de la sesión no son válidas.': 'The session dates are not valid.',
  'La clase asociada no es válida.': 'The linked class is not valid.',
  'No pudimos guardar el reporte de la clase. Intenta de nuevo en unos segundos.':
    "We couldn't save the class report. Try again in a few seconds.",
  'No pudimos consultar el historial de clases. Intenta de nuevo en unos segundos.':
    "We couldn't load the class history. Try again in a few seconds.",
  'No pudimos consultar el reporte de la clase. Intenta de nuevo en unos segundos.':
    "We couldn't load the class report. Try again in a few seconds.",
  'La clase asociada no corresponde a la sala de la sesión.':
    'The linked class does not match the session room.',
  'El identificador del episodio de error no es válido.': 'The error episode identifier is not valid.',
  'Tu nombre no puede empezar ni terminar con espacios.': 'Your name cannot start or end with spaces.',
  'Inicia sesión para entrar a la clase.': 'Sign in to join the class.',
  'Ese nombre ya está en uso en esta clase por otra cuenta. Elegí otro nombre para entrar.':
    'That name is already in use in this class by another account. Choose another name to join.',
  'No pudimos verificar tu nombre en la sala. Intenta de nuevo en unos segundos.':
    "We couldn't verify your name in the room. Try again in a few seconds.",
  'Demasiadas consultas desde tu conexión. Espera un minuto e intenta de nuevo.':
    'Too many requests from your connection. Wait a minute and try again.',
  'No pudimos consultar las clases programadas. Intenta de nuevo en unos segundos.':
    "We couldn't load the scheduled classes. Try again in a few seconds.",
  'No pudimos crear la clase. Intenta de nuevo en unos segundos.':
    "We couldn't create the class. Try again in a few seconds.",
  'No pudimos cancelar la clase. Intenta de nuevo en unos segundos.':
    "We couldn't cancel the class. Try again in a few seconds.",
  'No pudimos iniciar la clase. Intenta de nuevo en unos segundos.':
    "We couldn't start the class. Try again in a few seconds.",
  'No puedes programar una clase en una fecha u hora pasada.': 'You cannot schedule a class in the past.',
  'La sala no corresponde a la clase programada.': 'The room does not match the scheduled class.',
  'Esta ocurrencia de clase ya fue cancelada y no puede volver a crearse.':
    'This class occurrence was already cancelled and cannot be created again.',
  'La clase solicitada no existe.': 'The requested class does not exist.',
  'Solo el docente puede terminar la sesión para todos.': 'Only the teacher can end the session for everyone.',
  'No pudimos terminar la sesión. Intenta de nuevo en unos segundos.':
    "We couldn't end the session. Try again in a few seconds.",
  'Solo el docente a cargo de esta clase puede terminarla para todos.':
    'Only the teacher in charge of this class can end it for everyone.',
  'Las notificaciones solo están disponibles para profesores.': 'Notifications are only available to teachers.',
  'No se pudieron actualizar las notificaciones.': "The notifications couldn't be updated.",
  'El alcance no es válido.': 'The scope is not valid.',
  'Los errores pendientes no son válidos.': 'The pending errors are not valid.',
  'Debes indicar un título para la clase.': 'Enter a title for the class.',
  'Debes indicar una fecha y hora válidas para la clase.': 'Enter a valid date and time for the class.',
  'La cantidad de alumnos esperados no es válida.': 'The expected student count is not valid.',
  'La duración de la clase no es válida.': 'The class duration is not valid.',
  'La clave de creación no es válida. Reintenta desde el formulario.':
    'The creation key is not valid. Try again from the form.',
  'El nombre de la sala no es válido.': 'The room name is not valid.',
  'El rol debe ser profesor o estudiante.': 'The role must be teacher or student.',
  'El nombre no puede estar vacío.': 'The name cannot be empty.',
  'Los datos del perfil no son válidos.': 'The profile data is not valid.',
  'El nombre debe tener entre 1 y 100 caracteres.': 'The name must be between 1 and 100 characters.',
  'No pudimos sincronizar el correo.': "We couldn't sync the email.",
  'No pudimos restaurar la foto.': "We couldn't restore the photo.",
  'Las clases programadas solo están disponibles para profesores.': 'Scheduled classes are only available to teachers.',
  'El historial de clases solo está disponible para profesores.': 'Class history is only available to teachers.',
  'Los recursos de clase solo están disponibles para profesores.': 'Class resources are only available to teachers.',
  'Las grabaciones solo están disponibles para profesores.': 'Recordings are only available to teachers.',
  'La clave ya fue usada para otra operación.': 'The key was already used for a different operation.',
  'La notificación no existe en la bandeja actual.': 'The notification does not exist in the current inbox.',
};

type HeaderSource = { headers?: { [name: string]: unknown } } | undefined;

/** Spanish unless the request asks for English and this explanation is in the catalog. */
export function localizeExplanation(req: HeaderSource, explanation: string): string {
  if (resolveLocale(req) !== 'en') return explanation;
  return EN_EXPLANATION[explanation] || explanation;
}
