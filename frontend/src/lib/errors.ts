// Traduce errores de Supabase/red a mensajes que un mecánico entienda
// (hermano de auth-errors.ts, para operaciones de datos).

type AnyError = { code?: string; message?: string } | null | undefined;

export function friendlyError(error: AnyError, fallback: string): string {
  if (!error) return fallback;
  const msg = error.message ?? '';
  if (error.code === '23505') return 'Ese dato ya existe en tu taller (revisa la patente o el nombre).';
  if (error.code === '42501' || error.code === 'PGRST301') return 'No tienes permiso para hacer esto.';
  if (/failed to fetch|networkerror|fetch failed/i.test(msg)) return 'Sin conexión a internet. Intenta de nuevo cuando vuelva la señal.';
  return fallback;
}
