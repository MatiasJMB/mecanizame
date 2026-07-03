import { useAuth } from '../context/AuthContext';
import { billingInfo } from '../lib/billing';
import { formatMoney } from '../lib/format';
import { AlertCircle, CalendarDays } from 'lucide-react';

/** Aviso automático de cobro para el taller: aparece solo cuando la mensualidad
 *  está por vencer o ya venció (dentro de la gracia). Pasada la gracia, el acceso
 *  se bloquea en el login, así que aquí no hace falta el estado "suspendido". */
export default function BillingBanner() {
  const { activeOrganization } = useAuth();
  if (!activeOrganization) return null;

  const bi = billingInfo(activeOrganization.paid_until);
  if (bi.status !== 'por_vencer' && bi.status !== 'vencido') return null;

  const fee = activeOrganization.monthly_fee;
  const feeTxt = fee ? ` de ${formatMoney(fee)}` : '';
  const overdue = bi.status === 'vencido';
  const days = bi.daysUntilDue ?? 0;

  return (
    <div className={`flex items-center gap-2 border-b px-4 py-2 text-xs font-bold lg:backdrop-blur ${overdue ? 'billing-bar-danger' : 'billing-bar-warn'}`}>
      {overdue ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <CalendarDays className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0">
        {overdue ? (
          <>Tu servicio venció el <b>{bi.dueLabel}</b>. Paga tu mensualidad{feeTxt} antes del <b>{bi.suspendLabel}</b> o el acceso se suspenderá automáticamente.</>
        ) : (
          <>Tu mensualidad{feeTxt} vence el <b>{bi.dueLabel}</b>{` (${days === 0 ? 'hoy' : `en ${days} día${days === 1 ? '' : 's'}`})`}. Renueva para no perder el acceso.</>
        )}
      </span>
    </div>
  );
}
