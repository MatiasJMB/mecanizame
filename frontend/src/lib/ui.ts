import type { MouseEvent } from 'react';

/** onClick para filas clickeables: ignora clicks que nacen en controles internos
 *  (botones, selects, links…), así ningún hijo necesita stopPropagation. */
export function rowClick(handler: () => void) {
  return (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button,select,a,input,textarea,label')) return;
    handler();
  };
}
