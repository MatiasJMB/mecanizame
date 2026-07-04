// Estado de facturación de un taller, calculado por fecha desde `paid_until`.
// Sin cron: el estado se deriva en el momento (admin y taller ven lo mismo).
//
//   al_dia      → faltan más de `warnDays` para vencer
//   por_vencer  → dentro de la ventana de aviso (0..warnDays)
//   vencido     → venció pero aún dentro de la gracia (1..graceDays días)
//   suspendido  → pasó la gracia → acceso bloqueado
//   sin_definir → el super-admin aún no configuró el cobro (paid_until null)

import { santiagoToday } from './date';

export const BILLING = { warnDays: 7, graceDays: 3 } as const;

export type BillingStatus = 'sin_definir' | 'al_dia' | 'por_vencer' | 'vencido' | 'suspendido';

export type BillingInfo = {
  status: BillingStatus;
  label: string;
  daysUntilDue: number | null; // + faltan, − vencido hace N días
  dueLabel: string | null;     // fecha de vencimiento (dd-mm-aaaa)
  suspendLabel: string | null; // fecha en que se suspende (vencimiento + gracia)
  blocking: boolean;           // true = acceso suspendido
};

const LABELS: Record<BillingStatus, string> = {
  sin_definir: 'Sin definir',
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  suspendido: 'Suspendido',
};

// Clase de chip (definidas en index.css) por estado.
export const billingChip: Record<BillingStatus, string> = {
  sin_definir: 'chip-cancel',
  al_dia: 'chip-done',
  por_vencer: 'chip-pending',
  vencido: 'chip-danger',
  suspendido: 'chip-danger',
};

const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
const fmt = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function billingInfo(paidUntil: string | null | undefined, now: Date = new Date()): BillingInfo {
  if (!paidUntil) {
    return { status: 'sin_definir', label: LABELS.sin_definir, daysUntilDue: null, dueLabel: null, suspendLabel: null, blocking: false };
  }
  const due = noon(new Date(paidUntil + 'T12:00:00')); // interpretar como fecha local, sin corrimiento por zona horaria
  // "Hoy" anclado a la fecha calendario de Chile, no al reloj/zona del dispositivo del viewer.
  const today = noon(new Date(santiagoToday(now) + 'T12:00:00'));
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  const suspend = new Date(due);
  suspend.setDate(suspend.getDate() + BILLING.graceDays);

  let status: BillingStatus;
  if (days > BILLING.warnDays) status = 'al_dia';
  else if (days >= 0) status = 'por_vencer';
  else if (days >= -BILLING.graceDays) status = 'vencido';
  else status = 'suspendido';

  return {
    status,
    label: LABELS[status],
    daysUntilDue: days,
    dueLabel: fmt(due),
    suspendLabel: fmt(suspend),
    blocking: status === 'suspendido',
  };
}
