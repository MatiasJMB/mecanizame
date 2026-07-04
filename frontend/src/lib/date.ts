// Helpers de fecha compartidos por Órdenes y Finanzas.
// Nota: las claves de día/mes usan la hora LOCAL del navegador (la app se usa en Chile).
// Anclarlas a America/Santiago es una mejora pendiente para reporting multi-zona.

export const pad = (n: number) => String(n).padStart(2, '0');

/** Clave de día en hora local: `YYYY-MM-DD`. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Clave de mes en hora local: `YYYY-M` (mes 0-indexado, como los buckets de Finanzas). */
export const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

/** Suma `n` días a una fecha, sin mutar la original. */
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

type OrderItemLike = { description?: string | null; services?: { name: string | null } | null };

/** Nombres de los servicios/ítems de una orden (para chips y CSV). */
export const itemNames = (items: OrderItemLike[] | null | undefined): string[] =>
  (items ?? []).map((i) => i?.services?.name || i?.description).filter(Boolean) as string[];
