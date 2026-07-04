import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/api/client';
import { saveOrderEdit } from '@/api';
import { useAuth } from '../context/AuthContext';
import { canDelete } from '../lib/roles';
import { formatMoney, formatDate, formatDateTime, dateInputValue } from '../lib/format';
import { ORDER_STATUS, ORDER_STATUS_ORDER, type WorkOrderStatus } from '../lib/taller';
import { friendlyError } from '../lib/errors';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useConfirm } from './ConfirmProvider';
import ServiceLinesEditor, { linesTotal, type Line, type ServiceOpt } from './ServiceLinesEditor';
import { Loader2, X, Trash2, Pencil, Phone, Car, CalendarDays, StickyNote, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

type DetailItem = { id: string; service_id: string | null; description: string | null; quantity: number; unit_price: number; subtotal: number };
type Detail = {
  id: string; code: string | null; status: WorkOrderStatus; total_amount: number;
  scheduled_at: string | null; created_at: string; notes: string | null;
  customers: { id: string; full_name: string; phone: string | null } | null;
  vehicles: { id: string; license_plate: string; make: string | null; model: string | null; year: number | null; vin: string | null } | null;
  work_order_items: DetailItem[];
};

/** Detalle completo de una orden: ver, cambiar estado, editar servicios/fecha/notas y eliminar.
 *  Se abre desde Órdenes, la ficha del cliente y el Resumen. Carga sus propios datos por id. */
export default function OrderDetailModal({ orderId, onClose, onChanged, onDeleted }: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted?: () => void;
}) {
  useBodyScrollLock();
  const { organizationId, role, isSuperAdmin } = useAuth();
  const canDel = isSuperAdmin || canDelete(role);
  const confirm = useConfirm();
  const [order, setOrder] = useState<Detail | null>(null);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  // No cerrar con Escape mientras se edita (evita perder cambios), igual que el clic en el fondo.
  const dialogRef = useModalA11y(editing ? undefined : onClose);
  const [lines, setLines] = useState<Line[]>([]);
  const [scheduled, setScheduled] = useState('');
  const [notes, setNotes] = useState('');
  const [vinCopied, setVinCopied] = useState(false);
  const copyVin = async (vin: string) => {
    try { await navigator.clipboard.writeText(vin); setVinCopied(true); setTimeout(() => setVinCopied(false), 1500); } catch { /* noop */ }
  };

  const loadDetail = useCallback(async () => {
    const [oRes, sRes] = await Promise.all([
      supabase.from('work_orders')
        .select(`id, code, status, total_amount, scheduled_at, created_at, notes,
          customers(id, full_name, phone),
          vehicles(id, license_plate, make, model, year, vin),
          work_order_items(id, service_id, description, quantity, unit_price, subtotal)`)
        .eq('id', orderId).single(),
      supabase.from('services').select('id, name, base_price')
        .eq('organization_id', organizationId!).eq('is_active', true).is('deleted_at', null).order('name'),
    ]);
    if (oRes.error || !oRes.data) {
      toast.error(friendlyError(oRes.error, 'No se pudo cargar la orden'));
      onClose();
      return;
    }
    setOrder(oRes.data as unknown as Detail);
    setServices((sRes.data ?? []) as ServiceOpt[]);
    setLoading(false);
  }, [orderId, organizationId, onClose]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const startEdit = () => {
    if (!order) return;
    setLines(order.work_order_items.map((i) => ({
      id: i.id, service_id: i.service_id, description: i.description ?? '', quantity: i.quantity, unit_price: i.unit_price,
    })));
    setScheduled(dateInputValue(order.scheduled_at));
    setNotes(order.notes ?? '');
    setEditing(true);
  };

  const changeStatus = async (status: WorkOrderStatus) => {
    if (!order || status === order.status) return;
    if (status === 'cancelled') {
      const ok = await confirm({
        title: '¿Anular este trabajo?',
        message: 'La orden quedará como Anulada y no contará en Finanzas. Puedes volver a cambiar el estado después.',
        confirmText: 'Sí, anular',
      });
      if (!ok) return;
    }
    const prev = order.status;
    setOrder({ ...order, status });
    const { error } = await supabase.from('work_orders').update({ status }).eq('id', order.id);
    if (error) {
      setOrder((o) => (o ? { ...o, status: prev } : o));
      return toast.error(friendlyError(error, 'No se pudo cambiar el estado'));
    }
    if (status === 'completed') toast.success('Trabajo terminado — ya suma en Finanzas');
    onChanged();
  };

  const remove = async () => {
    if (!order) return;
    const ok = await confirm({
      title: `Eliminar orden ${order.code ?? ''}`,
      message: 'La orden se borra para siempre, junto con su monto en Finanzas. No se puede deshacer.',
      confirmText: 'Eliminar orden',
    });
    if (!ok) return;
    const { error } = await supabase.from('work_orders').delete().eq('id', order.id);
    if (error) return toast.error(friendlyError(error, 'No se pudo eliminar la orden'));
    toast.success('Orden eliminada');
    (onDeleted ?? onChanged)();
  };

  const saveEdit = async () => {
    if (!order) return;
    if (lines.length === 0) return toast.error('Agrega al menos un servicio');
    setSaving(true);
    const { error } = await saveOrderEdit({
      orderId: order.id,
      scheduledAt: scheduled ? new Date(scheduled + 'T00:00:00').toISOString() : null,
      notes: notes.trim() || null,
      items: lines.map((l) => ({
        id: l.id ?? null, service_id: l.service_id,
        description: l.description || 'Servicio', quantity: l.quantity, unit_price: l.unit_price,
      })),
    });
    setSaving(false);
    if (error) return toast.error(friendlyError(error, 'No se pudieron guardar los cambios'));
    toast.success('Orden actualizada');
    setEditing(false);
    setLoading(true);
    await loadDetail();
    onChanged();
  };

  const vehicleLabel = order?.vehicles
    ? [order.vehicles.make, order.vehicles.model, order.vehicles.year].filter(Boolean).join(' ')
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={editing ? undefined : onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}
        className="animate-scaleIn max-h-[90vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-gray-900 p-6 outline-none" onClick={(e) => e.stopPropagation()}>
        {loading || !order ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black">{order.code ?? 'Orden de servicio'}</h3>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS[order.status].color}`}>
                  {ORDER_STATUS[order.status].label}
                </span>
              </div>
              <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className="rounded-lg p-1 text-gray-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>

            {/* Cliente + vehículo */}
            <div className="rounded-xl border border-white/10 bg-gray-950/40 p-3.5">
              <p className="font-bold">{order.customers?.full_name ?? 'Sin cliente'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                {order.customers?.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {order.customers.phone}</span>}
                {order.vehicles ? (
                  <span className="flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5" />
                    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono font-bold text-gray-300">{order.vehicles.license_plate}</span>
                    {vehicleLabel}
                  </span>
                ) : <span className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Sin vehículo</span>}
                {order.vehicles?.vin && (
                  <span className="flex items-center gap-1.5">
                    VIN <code className="font-mono text-gray-300">{order.vehicles.vin}</code>
                    <button onClick={() => copyVin(order.vehicles!.vin!)} title="Copiar VIN para cotizar repuestos"
                      className="rounded p-0.5 text-gray-400 transition-colors hover:text-blue-300">
                      {vinCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </span>
                )}
              </div>
            </div>

            {editing ? (
              /* ----- Modo edición ----- */
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Servicios</p>
                  <ServiceLinesEditor lines={lines} services={services} onChange={setLines} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">¿Para qué día se agenda?</label>
                    <input type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className="inp" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Notas</label>
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Diagnóstico, observaciones…" className="inp" />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-gray-950/40 px-4 py-3">
                  <span className="text-sm font-bold text-gray-400">Total</span>
                  <span className="text-lg font-black text-blue-300">{formatMoney(linesTotal(lines))}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold hover:bg-white/5">Cancelar</button>
                  <button onClick={saveEdit} disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50">
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ) : (
              /* ----- Modo vista ----- */
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Servicios</p>
                  {order.work_order_items.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin servicios registrados.</p>
                  ) : (
                    <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-gray-950/40 px-3.5">
                      {order.work_order_items.map((i) => (
                        <div key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                          <p className="min-w-0 truncate text-sm">{i.description || 'Servicio'}{i.quantity > 1 && <span className="ml-1 text-xs text-gray-500">×{i.quantity}</span>}</p>
                          <span className="shrink-0 text-sm font-bold">{formatMoney(i.subtotal)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 py-2.5">
                        <span className="text-sm font-bold text-gray-400">Total</span>
                        <span className="text-lg font-black text-blue-300">{formatMoney(order.total_amount)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Ingresó el {formatDate(order.created_at)}</span>
                  {order.scheduled_at && <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Agendada para el {formatDateTime(order.scheduled_at)}</span>}
                </div>
                {order.notes && (
                  <p className="flex items-start gap-1.5 rounded-xl border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-300">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" /> {order.notes}
                  </p>
                )}

                {/* Acciones */}
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
                    Estado
                    <select value={order.status} onChange={(e) => changeStatus(e.target.value as WorkOrderStatus)}
                      className="rounded-xl border border-white/10 px-2 py-1.5 text-xs font-bold">
                      {ORDER_STATUS_ORDER.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
                    </select>
                  </label>
                  <div className="ml-auto flex gap-2">
                    {canDel && (
                      <button onClick={remove} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    )}
                    <button onClick={startEdit} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white hover:bg-blue-500">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
