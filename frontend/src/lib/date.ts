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

/** Suma `n` meses clampeando al último día del mes destino, igual que Postgres `+ interval '1 month'`
 *  (31-ene + 1 mes = 28-feb, no 3-mar). Mantiene el preview de facturación alineado con el RPC. */
export const addMonthsClamped = (base: Date, n: number): Date => {
  const day = base.getDate();
  const d = new Date(base.getFullYear(), base.getMonth() + n, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};

/** Fecha "hoy" en America/Santiago como `YYYY-MM-DD`, sin importar la zona del dispositivo.
 *  Ancla el estado de facturación al día chileno (no al reloj de cada viewer). */
export const santiagoToday = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

type OrderItemLike = { description?: string | null; services?: { name: string | null } | null };

/** Nombres de los servicios/ítems de una orden (para chips y CSV). */
export const itemNames = (items: OrderItemLike[] | null | undefined): string[] =>
  (items ?? []).map((i) => i?.services?.name || i?.description).filter(Boolean) as string[];
