/**
 * Translates common Supabase Auth error messages to Spanish.
 */
export function translateError(message: string): string {
  if (!message) return 'Ocurrió un error inesperado.';

  const errors: Record<string, string> = {
    'Invalid login credentials': 'El correo o la contraseña son incorrectos.',
    'User already registered': 'Este correo electrónico ya está registrado.',
    'New password should be different from the old password.': 'La nueva contraseña debe ser diferente a la antigua.',
    'Email not confirmed': 'Debes confirmar tu correo electrónico antes de ingresar.',
    'Invalid email': 'El formato del correo electrónico no es válido.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
    'Database error saving new user': 'Hubo un problema al guardar el usuario en la base de datos.',
    'Invite key invalid': 'El código de invitación es inválido.',
    'Invite key used': 'Este código de invitación ya ha sido utilizado.',
    'User not found': 'No se encontró ningún usuario con ese correo.',
    'Password is too short': 'La contraseña es demasiado corta.',
    'Unexpected error': 'Ocurrió un error inesperado. Inténtalo de nuevo.',
    'Email link for password reset sent. Please check your email.': 'Se ha enviado un correo para restablecer tu contraseña.',
    'Recovery link expired': 'El enlace de recuperación ha expirado. Solicita uno nuevo.',
    'Too many requests': 'Demasiados intentos. Por favor, inténtalo más tarde.',
    'Network error': 'Error de conexión. Revisa tu conexión a internet.'
  };

  // Parcial matching for some errors
  if (message.includes('New password should be different')) {
    return errors['New password should be different from the old password.'];
  }
  
  if (message.includes('shorter than 6 characters')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }

  return errors[message] || message;
}
