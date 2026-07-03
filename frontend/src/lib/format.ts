// Utilidades de formato para Chile (CLP sin decimales, fechas es-CL).

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/** Formatea un entero CLP. 0 o null → "A cotizar". */
export function formatCLP(value: number | null | undefined): string {
  if (value == null || value === 0) return 'A cotizar';
  return clp.format(value);
}

/** Formatea CLP siempre como monto (0 → "$0"), para totales de órdenes. */
export function formatMoney(value: number | null | undefined): string {
  return clp.format(value ?? 0);
}

/** Monto CLP compacto para ejes/etiquetas de gráficos: $1,2M / $450k / $900. */
export function formatCompactCLP(value: number | null | undefined): string {
  const v = value ?? 0;
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + 'M';
  if (v >= 1_000) return '$' + Math.round(v / 1000) + 'k';
  return '$' + v;
}

/** Convierte un string de input (ej. "150.000" o "150000") a entero CLP. */
export function parseCLP(input: string): number {
  const digits = (input || '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

const dateFmt = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return dateTimeFmt.format(new Date(value));
}

/** Convierte un timestamptz ISO a valor para <input type="datetime-local">. */
export function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

/** Convierte un timestamptz ISO a valor para <input type="date"> (día local, sin desfase). */
export function dateInputValue(value: string | null | undefined): string {
  return toDatetimeLocal(value).slice(0, 10);
}

/** Normaliza texto para búsquedas: sin acentos y en minúsculas. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
