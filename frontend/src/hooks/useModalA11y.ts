import { useEffect, useRef } from 'react';

/** Accesibilidad base para modales: cierra con Escape, mueve el foco al panel al abrir y lo
 *  restaura al elemento previo al cerrar. Devuelve el ref para el contenedor del diálogo
 *  (añádele `role="dialog" aria-modal="true" tabIndex={-1}`). */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose?: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // Si ningún control interno tomó el foco (autoFocus), enfocar el panel.
    if (el && !el.contains(document.activeElement)) el.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, []);

  return ref;
}
