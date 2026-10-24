/**
 * English copy keyed by the current Spanish source string.
 * Missing keys fall back to Spanish, so a screen can be migrated one string at a time.
 * Do not put the `[Profesor]` identity suffix here — it is a protocol token, not copy.
 */
export const EN: { [spanish: string]: string } = {
  Idioma: 'Language',
  'Soy profesor': "I'm a teacher",
  'Crear y dar clases': 'Create and teach classes',
  'Soy estudiante': "I'm a student",
  'Unirme a clases existentes': 'Join existing classes',
  'Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo.':
    'Incorrect email or password. Check your details and try again.',
  'Ya existe una cuenta con este correo. Inicia sesión para continuar.':
    'An account with this email already exists. Sign in to continue.',
  'La contraseña es demasiado débil. Usa al menos 6 caracteres.':
    'The password is too weak. Use at least 6 characters.',
  'El correo electrónico no es válido.': 'The email address is not valid.',
  'Demasiados intentos. Espera unos minutos e intenta de nuevo.':
    'Too many attempts. Wait a few minutes and try again.',
  'No pudimos completar la operación. Intenta de nuevo en unos segundos.':
    "We couldn't complete that. Try again in a few seconds.",
  '¿Cómo vas a usar Attendia?': 'How will you use Attendia?',
  'Selecciona tu rol para terminar de configurar tu cuenta.': 'Choose your role to finish setting up your account.',
  'Conectado como': 'Signed in as',
  'Confirmar y continuar': 'Confirm and continue',
  'Cancelar la configuración y cerrar sesión': 'Cancel setup and sign out',
  'Cancelar y cerrar sesión': 'Cancel and sign out',
  'Iniciar sesión': 'Sign in',
  'Accede con tu cuenta para entrar a tus clases.': 'Sign in with your account to join your classes.',
  'Correo electrónico': 'Email',
  Contraseña: 'Password',
  o: 'or',
  'Continuar con Google': 'Continue with Google',
  '¿No tienes cuenta?': "Don't have an account?",
  'Crear cuenta': 'Create account',
  'Regístrate para crear o unirte a clases en Attendia.': 'Sign up to create or join classes on Attendia.',
  'Nombre completo': 'Full name',
  '¿Ya tienes cuenta?': 'Already have an account?',
  'Seguridad y Privacidad': 'Security and privacy',
  'Sin audio': 'No audio',
  Silenciar: 'Mute',
  Activar: 'Unmute',
  'Sin video': 'No video',
  'Detener video': 'Stop video',
  'Iniciar video': 'Start video',
  'Compartir pantalla': 'Share screen',
  'Dejar de compartir': 'Stop sharing',
  Compartir: 'Share',
  'No puedes compartir pantalla mientras otro usuario lo está haciendo':
    'You cannot share your screen while someone else is sharing',
  'Pide permiso al profesor para compartir pantalla': 'Ask the teacher for permission to share your screen',
  'Este navegador no admite compartir pantalla': 'This browser does not support screen sharing',
  'Bajar la mano': 'Lower hand',
  'Levantar la mano': 'Raise hand',
  'Bajar mano': 'Lower hand',
  'Levantar mano': 'Raise hand',
  Salir: 'Leave',
  'Terminar sesión': 'End session',
  '¿Terminar la sesión?': 'End the session?',
  'Puedes salir tú solo y dejar la clase abierta para que los estudiantes continúen, o terminar la sesión para todos y cerrar la sala.':
    'You can leave on your own and keep the class open for students, or end the session for everyone and close the room.',
  Cancelar: 'Cancel',
  'Salir sin cerrar': 'Leave without ending',
  'Terminando…': 'Ending…',
  'Terminar para todos': 'End for everyone',
};
