import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney, formatDate, formatDateTime, parseCLP } from '../lib/format';
import { ORDER_STATUS, ORDER_STATUS_ORDER, type WorkOrderStatus } from '../lib/taller';
import { Plus, Loader2, X, Trash2, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

type Order = {
  id: string; code: string | null; status: WorkOrderStatus; total_amount: number;
  scheduled_at: string | null; created_at: string; notes: string | null;
  customers: { full_name: string } | null;
  vehicles: { license_plate: string; make: string | null; model: string | null } | null;
};

const FILTERS: (WorkOrderStatus | 'all')[] = ['all', ...ORDER_STATUS_ORDER];

export default function Ordenes() {
  const { organizationId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { document.title = 'Órdenes — Taller SaaS'; }, []);

  const load = async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data } = await supabase
      .from('work_orders')
      .select('id, code, status, total_amount, scheduled_at, created_at, notes, customers(full_name), vehicles(license_plate, make, model)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as unknown as Order[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const s of ORDER_STATUS_ORDER) c[s] = orders.filter((o) => o.status === s).length;
    return c;
  }, [orders]);

  const visible = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  const changeStatus = async (o: Order, status: WorkOrderStatus) => {
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status } : x)));
    const { error } = await supabase.from('work_orders').update({ status }).eq('id', o.id);
    if (error) { toast.error('No se pudo actualizar'); load(); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Órdenes de servicio</h1>
          <p className="mt-1 text-sm text-gray-400">Trabajos por estado. Crea órdenes manuales ligadas a una patente.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black hover:bg-orange-500">
          <Plus className="h-4 w-4" /> Nueva orden
        </button>
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${filter === s ? 'border-orange-500/50 bg-orange-500/15 text-orange-300' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}>
            {s === 'all' ? 'Todas' : ORDER_STATUS[s].label} <span className="opacity-60">({counts[s] ?? 0})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <ClipboardList className="mx-auto h-9 w-9 text-gray-600" />
          <p className="mt-3 text-sm text-gray-500">No hay órdenes {filter !== 'all' ? `en estado "${ORDER_STATUS[filter as WorkOrderStatus].label}"` : 'todavía'}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-gray-900/40 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${ORDER_STATUS[o.status].dot}`} />
                  <p className="truncate font-bold">{o.customers?.full_name ?? 'Sin cliente'}</p>
                  {o.vehicles?.license_plate && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-gray-300">{o.vehicles.license_plate}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {o.code ?? '—'} · creada {formatDate(o.created_at)}
                  {o.scheduled_at && ` · agenda ${formatDateTime(o.scheduled_at)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black">{formatMoney(o.total_amount)}</span>
                <select value={o.status} onChange={(e) => changeStatus(o, e.target.value as WorkOrderStatus)}
                  className="rounded-lg border border-white/10 bg-gray-950/60 px-2 py-1 text-xs font-bold">
                  {ORDER_STATUS_ORDER.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <OrderForm organizationId={organizationId!} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

/* ---------- Formulario Nueva orden ---------- */

type CustomerOpt = { id: string; full_name: string; vehicles: { id: string; license_plate: string; make: string | null; model: string | null }[] };
type ServiceOpt = { id: string; name: string; base_price: number };
type Line = { service_id: string | null; description: string; quantity: number; unit_price: number };

function OrderForm({ organizationId, onClose, onSaved }: {
  organizationId: string; onClose: () => void; onSaved: () => void;
}) {
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [addServiceId, setAddServiceId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState<WorkOrderStatus>('pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([
        supabase.from('customers').select('id, full_name, vehicles(id, license_plate, make, model)').eq('organization_id', organizationId).is('deleted_at', null).order('full_name'),
        supabase.from('services').select('id, name, base_price').eq('organization_id', organizationId).eq('is_active', true).is('deleted_at', null).order('name'),
      ]);
      setCustomers((cRes.data ?? []) as unknown as CustomerOpt[]);
      setServices((sRes.data ?? []) as ServiceOpt[]);
      setLoading(false);
    })();
  }, [organizationId]);

  const vehicles = customers.find((c) => c.id === customerId)?.vehicles ?? [];
  const total = lines.reduce((a, l) => a + l.unit_price * l.quantity, 0);

  const addLine = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setLines((prev) => [...prev, { service_id: svc.id, description: svc.name, quantity: 1, unit_price: svc.base_price }]);
    setAddServiceId('');
  };
  const updateLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!customerId) return toast.error('Selecciona un cliente');
    if (lines.length === 0) return toast.error('Agrega al menos un servicio');
    setSaving(true);
    try {
      const { count } = await supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId);
      const code = 'OT-' + String((count ?? 0) + 1).padStart(4, '0');

      const { data: order, error } = await supabase.from('work_orders').insert({
        organization_id: organizationId,
        customer_id: customerId,
        vehicle_id: vehicleId || null,
        code, status,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        total_amount: total,
        notes: notes.trim() || null,
      }).select('id').single();
      if (error || !order) throw error;

      const items = lines.map((l) => ({
        work_order_id: order.id,
        service_id: l.service_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        subtotal: l.unit_price * l.quantity,
      }));
      const { error: itemsErr } = await supabase.from('work_order_items').insert(items);
      if (itemsErr) throw itemsErr;

      toast.success(`Orden ${code} creada`);
      onSaved();
    } catch {
      toast.error('No se pudo crear la orden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">Nueva orden de servicio</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>
        ) : (
          <div className="space-y-4">
            {customers.length === 0 && (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                No hay clientes aún. Crea un cliente en la sección Clientes primero.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <L label="Cliente">
                <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(''); }} className="inp">
                  <option value="">Selecciona…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </L>
              <L label="Vehículo (patente)">
                <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="inp" disabled={!customerId}>
                  <option value="">Sin vehículo</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.license_plate} · {[v.make, v.model].filter(Boolean).join(' ')}</option>)}
                </select>
              </L>
            </div>

            {/* Servicios */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="ml-1 text-xs font-bold uppercase tracking-widest text-gray-400">Servicios</label>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-white/10 bg-gray-950/40 p-2">
                    <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })}
                      className="inp flex-1 !py-1.5 text-sm" />
                    <input value={l.unit_price ? String(l.unit_price) : ''} inputMode="numeric"
                      onChange={(e) => updateLine(i, { unit_price: parseCLP(e.target.value) })}
                      placeholder="Precio" className="inp w-24 !py-1.5 text-sm" />
                    <button onClick={() => removeLine(i)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <select value={addServiceId} onChange={(e) => e.target.value && addLine(e.target.value)} className="inp text-sm">
                  <option value="">+ Agregar servicio del catálogo…</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <L label="Fecha agendada (opcional)">
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="inp" />
              </L>
              <L label="Estado">
                <select value={status} onChange={(e) => setStatus(e.target.value as WorkOrderStatus)} className="inp">
                  {ORDER_STATUS_ORDER.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
                </select>
              </L>
            </div>
            <L label="Notas (opcional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="inp resize-none" placeholder="Diagnóstico, observaciones…" />
            </L>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-gray-950/40 px-4 py-3">
              <span className="text-sm font-bold text-gray-400">Total</span>
              <span className="text-xl font-black text-orange-300">{formatMoney(total)}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold hover:bg-white/5">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-black hover:bg-orange-500 disabled:opacity-50">
                {saving ? 'Creando…' : 'Crear orden'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</label>
      {children}
    </div>
  );
}
