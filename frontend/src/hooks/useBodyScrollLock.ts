import { useEffect } from 'react';

/** Bloquea el scroll del body mientras un modal está montado (evita que el
 *  fondo se desplace al hacer scroll dentro del modal). */
export function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
}
