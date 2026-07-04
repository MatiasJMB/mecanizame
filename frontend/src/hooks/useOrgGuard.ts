import { useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/** Guardia contra respuestas obsoletas al cambiar de taller (o entrar/salir de impersonación).
 *
 *  Varias páginas recargan por su dep-array `[organizationId]` y también de forma imperativa
 *  (onSaved/onChanged). Si el taller activo cambia con un fetch en vuelo, la respuesta vieja
 *  puede resolverse última y pintar datos del taller equivocado. Uso:
 *
 *    const isFresh = useOrgGuard();
 *    const oid = organizationId;            // capturar al iniciar
 *    const { data } = await supabase...;
 *    if (!isFresh(oid)) return;             // descartar si el taller ya cambió
 *    setRows(data);
 */
export function useOrgGuard() {
  const { organizationId } = useAuth();
  const ref = useRef(organizationId);
  ref.current = organizationId;
  // Identidad estable: seguro de incluir en dep-arrays sin recrear el efecto.
  return useCallback((capturedOrgId: string | null) => capturedOrgId === ref.current, []);
}
