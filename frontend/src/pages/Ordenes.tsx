import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/api/client';
import { createWorkOrder } from '@/api';
import { useAuth } from '../context/AuthContext';
import { useOrgGuard } from '@/hooks/useOrgGuard';
import { useSearch } from '../context/SearchContext';
import { formatMoney, formatDate, formatDateTime, norm } from '../lib/format';
import { dayKey, addDays, itemNames } from '../lib/date';
import ServiceLinesEditor, { linesTotal, type Line, type ServiceOpt } from '../components/ServiceLinesEditor';
import OrderDetailModal from '../components/OrderDetailModal';
import { rowClick } from '../lib/ui';
import { ORDER_STATUS, ORDER_STATUS_ORDER, ACTIVE_STATUSES, HISTORY_STATUSES, type WorkOrderStatus } from '../lib/taller';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import SegmentedToggle from '../components/SegmentedToggle';
import SmartVehicleFields from '../components/SmartVehicleFields';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useConfirm } from '../components/ConfirmProvider';
import { canDelete } from '../lib/roles';
import EmptyState from '../components/EmptyState';
import { friendlyError } from '../lib/errors';
import { Plus, Loader2, X, Trash2, ClipboardList, List, CalendarDays, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';

type Item = { description: string | null; services: { name: string } | null };
type Order = {
  id: string; code: string | null; status: WorkOrderStatus; total_amount: number;
  scheduled_at: string | null; created_at: string; notes: string | null;
  customers: { full_name: string } | null;
  vehicles: { license_plate: string; make: string | null; model: string | null } | null;
  work_order_items: Item[];
};

// Dos pestañas: lo que está en el taller ahora vs. lo ya cerrado.
const TABS = [
  { key: 'active', label: 'Activas', statuses: ACTIVE_STATUSES },
  { key: 'history', label: 'Historial', statuses: HISTORY_STATUSES },
] as const;
type Tab = (typeof TABS)[number]['key'];

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export default function Ordenes() {
  const { organizationId, role, isSuperAdmin } = useAuth();
  const isFresh = useOrgGuard();
  const canDel = isSuperAdmin || canDelete(role);
  const confirm = useConfirm();
  const { query } = useSearch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [cursor, setCursor] = useState(() => firstOfMonth(new Date()));
  const [dateField, setDateField] = useState<'created_at' | 'scheduled_at'>('created_at');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Para la guía encadenada del estado vacío: ¿ya hay clientes y catálogo?
  const [customerCount, setCustomerCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);

  useEffect(() => { document.title = 'Órdenes — Mecanízame'; }, []);

  const load = async () => {
    if (!organizationId) return;
    const oid = organizationId;
    setLoading(true);
    const [ordersR, customersR, servicesR] = await Promise.all([
      supabase
        .from('work_orders')
        .select('id, code, status, total_amount, scheduled_at, created_at, notes, customers(full_name), vehicles(license_plate, make, model), work_order_items(description, services(name))')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true).is('deleted_at', null),
    ]);
    if (!isFresh(oid)) return;
    setOrders((ordersR.data ?? []) as unknown as Order[]);
    setCustomerCount(customersR.count ?? 0);
    setServiceCount(servicesR.count ?? 0);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  // Buscador global: filtra por cliente, patente o código OT (lista y calendario).
  const searched = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return orders;
    return orders.filter((o) =>
      norm(o.customers?.full_name ?? '').includes(q) ||
      norm(o.vehicles?.license_plate ?? '').includes(q) ||
      norm(o.code ?? '').includes(q));
  }, [orders, query]);

  const counts = useMemo(() => ({
    active: searched.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    history: searched.filter((o) => HISTORY_STATUSES.includes(o.status)).length,
  }), [searched]);

  const tabStatuses: readonly WorkOrderStatus[] = tab === 'active' ? ACTIVE_STATUSES : HISTORY_STATUSES;
  const visible = searched.filter((o) => tabStatuses.includes(o.status));

  const byDay = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of searched) {
      const raw = o[dateField];
      if (!raw) continue;
      const key = dayKey(new Date(raw));
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(o);
    }
    return m;
  }, [searched, dateField]);

  const deleteOrder = async (o: Order) => {
    const ok = await confirm({ title: `Eliminar orden ${o.code ?? ''}`, message: 'La orden se borra para siempre, junto con su monto en Finanzas. No se puede deshacer.', confirmText: 'Eliminar orden' });
    if (!ok) return;
    const { error } = await supabase.from('work_orders').delete().eq('id', o.id);
    if (error) return toast.error(friendlyError(error, 'No se pudo eliminar la orden'));
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    toast.success('Orden eliminada');
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Órdenes de servicio" subtitle="Trabajos del taller ligados a un cliente y su patente. Ve la lista o el calendario de ingresos." help={HELP.ordenes}>
        <button onClick={() => setShowForm(true)} data-tour="nueva-orden" className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-500">
          <Plus className="h-4 w-4" /> Nueva orden
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === 'list' ? (
          <div className="flex flex-wrap gap-2" data-tour="filtros-ordenes">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${tab === t.key ? 'border-blue-500/50 bg-blue-500/15 text-blue-300' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}>
                {t.label} <span className="opacity-60">({counts[t.key]})</span>
              </button>
            ))}
          </div>
        ) : <span className="text-xs text-gray-500">Cada día muestra los vehículos ingresados con su dueño.</span>}
        <SegmentedToggle value={view} onChange={(v) => { setView(v); setSelectedDay(null); }}
          options={[{ v: 'list', label: 'Lista', icon: <List className="h-3.5 w-3.5" /> }, { v: 'calendar', label: 'Calendario', icon: <CalendarDays className="h-3.5 w-3.5" /> }]} />
      </div>

      {view === 'list' ? (
        visible.length === 0 ? (
          query.trim() ? (
            <EmptyState icon={ClipboardList} title={`Sin resultados para «${query}»`}
              description="Busca por el nombre del cliente, la patente o el código OT." />
          ) : customerCount === 0 ? (
            <EmptyState icon={Users} title="Para crear una orden primero necesitas un cliente"
              description="Registra al cliente con su vehículo; después vuelves aquí y le creas la orden de trabajo."
              action={{ label: 'Ir a Clientes', to: '/clientes' }} />
          ) : orders.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Aún no hay órdenes de trabajo"
              description="Crea la primera: eliges el cliente, su vehículo y los servicios. El total se calcula solo."
              action={{ label: 'Nueva orden', onClick: () => setShowForm(true), icon: <Plus className="h-4 w-4" /> }}
              secondary={serviceCount === 0 ? { label: 'Cargar catálogo de servicios', to: '/servicios' } : undefined} />
          ) : tab === 'active' ? (
            <EmptyState icon={ClipboardList} title="No hay trabajos en el taller ahora"
              description="Las órdenes nuevas aparecen aquí; las terminadas o anuladas quedan en Historial."
              action={{ label: 'Nueva orden', onClick: () => setShowForm(true), icon: <Plus className="h-4 w-4" /> }}
              secondary={counts.history > 0 ? { label: 'Ver historial', onClick: () => setTab('history') } : undefined} />
          ) : (
            <EmptyState icon={ClipboardList} title="Aún no hay trabajos terminados ni anulados"
              description="Cuando termines o anules una orden, quedará guardada aquí."
              secondary={counts.active > 0 ? { label: 'Ver activas', onClick: () => setTab('active') } : undefined} />
          )
        ) : (
          <div key={tab} className="custom-scrollbar space-y-2 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto lg:pr-1">
            {visible.map((o) => (
              <div key={o.id} role="button" tabIndex={0}
                onClick={rowClick(() => setDetailId(o.id))}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setDetailId(o.id); } }}
                aria-label={`Ver orden de ${o.customers?.full_name ?? 'sin cliente'}`}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-gray-900/40 p-4 transition-colors hover:border-blue-500/30 hover:bg-gray-900/60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${ORDER_STATUS[o.status].dot}`} />
                    <p className="truncate font-bold">{o.customers?.full_name ?? 'Sin cliente'}</p>
                    {o.vehicles?.license_plate && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-gray-300">{o.vehicles.license_plate}</span>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {o.code ?? '—'} · creada {formatDate(o.created_at)}{o.scheduled_at && ` · agenda ${formatDateTime(o.scheduled_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black">{formatMoney(o.total_amount)}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS[o.status].color}`}>{ORDER_STATUS[o.status].label}</span>
                  {canDel && <button onClick={() => deleteOrder(o)} title="Eliminar orden" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <CalendarView cursor={cursor} setCursor={setCursor} dateField={dateField} setDateField={setDateField}
          byDay={byDay} selectedDay={selectedDay} setSelectedDay={setSelectedDay} onOpen={setDetailId} onDelete={deleteOrder} canDelete={canDel} />
      )}

      {showForm && <OrderForm organizationId={organizationId!} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {detailId && (
        <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)}
          onChanged={load} onDeleted={() => { setDetailId(null); load(); }} />
      )}
    </div>
  );
}

/* ---------- Vista calendario ---------- */
function CalendarView({
  cursor, setCursor, dateField, setDateField, byDay, selectedDay, setSelectedDay, onOpen, onDelete, canDelete,
}: {
  cursor: Date; setCursor: (d: Date) => void;
  dateField: 'created_at' | 'scheduled_at'; setDateField: (f: 'created_at' | 'scheduled_at') => void;
  byDay: Map<string, Order[]>; selectedDay: string | null; setSelectedDay: (d: string | null) => void;
  onOpen: (id: string) => void;
  onDelete: (o: Order) => void;
  canDelete: boolean;
}) {
  const todayKey = dayKey(new Date());
  const first = firstOfMonth(cursor);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const monthName = cursor.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

  const monthOrders = cells
    .filter((d) => d.getMonth() === cursor.getMonth())
    .flatMap((d) => byDay.get(dayKey(d)) ?? []);
  const monthTotal = monthOrders.reduce((a, o) => a + (o.total_amount ?? 0), 0);

  const dayOrders = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const daySum = dayOrders.reduce((a, o) => a + (o.total_amount ?? 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5"><ChevronLeft className="h-4 w-4" /></button>
            <h2 className="min-w-40 text-center text-sm font-black capitalize">{monthName}</h2>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => setCursor(firstOfMonth(new Date()))} className="ml-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/5">Hoy</button>
          </div>
          <SegmentedToggle value={dateField} onChange={setDateField}
            options={[{ v: 'created_at', label: 'Ingreso' }, { v: 'scheduled_at', label: 'Agenda' }]} />
        </div>

        <div className="grid grid-cols-7 gap-1 px-1 pb-2">
          {DAY_LABELS.map((d) => <div key={d} className="text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">{d}</div>)}
        </div>
        <div key={monthName} className="animate-fadeIn grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const key = dayKey(d);
            const list = byDay.get(key) ?? [];
            const outside = d.getMonth() !== cursor.getMonth();
            const isToday = key === todayKey;
            const sel = key === selectedDay;
            return (
              <button key={key} onClick={() => setSelectedDay(sel ? null : key)}
                className={[
                  'group relative flex min-h-[84px] flex-col rounded-xl border p-1.5 text-left transition-colors',
                  outside ? 'border-white/5 text-gray-600' : 'border-white/10 hover:bg-white/5',
                  sel ? 'border-blue-500/50 bg-blue-500/10' : isToday ? 'ring-1 ring-blue-500/40' : '',
                ].join(' ')}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isToday ? 'grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white' : ''}`}>{d.getDate()}</span>
                  {list.length > 0 && <span className="rounded-full bg-blue-500/15 px-1.5 text-[10px] font-black text-blue-300">{list.length}</span>}
                </div>
                <div className="mt-1 space-y-0.5 overflow-hidden">
                  {list.slice(0, 2).map((o) => (
                    <div key={o.id} className="hidden items-center gap-1 truncate rounded bg-gray-950/40 px-1 py-0.5 text-[10px] sm:flex">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ORDER_STATUS[o.status].dot}`} />
                      <span className="truncate text-gray-300">{o.customers?.full_name ?? 'Sin cliente'}</span>
                      {o.vehicles?.license_plate && <span className="ml-auto shrink-0 font-mono text-gray-500">{o.vehicles.license_plate}</span>}
                    </div>
                  ))}
                  {list.length > 2 && <span className="text-[10px] text-gray-500">+{list.length - 2} más</span>}
                </div>
                <div className="mt-auto flex gap-0.5 pt-1 sm:hidden">
                  {list.slice(0, 4).map((o) => <span key={o.id} className={`h-1.5 w-1.5 rounded-full ${ORDER_STATUS[o.status].dot}`} />)}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between px-1 text-xs text-gray-500">
          <span>{monthOrders.length} orden(es) este mes</span>
          <span className="font-bold">{formatMoney(monthTotal)}</span>
        </div>
      </div>

      {/* Detalle del día */}
      <div className="lg:col-span-1">
        {!selectedDay ? (
          <div className="grid h-full min-h-[160px] place-items-center rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
            <div><CalendarDays className="mx-auto mb-2 h-7 w-7 text-gray-600" />Elige un día para ver sus ingresos.</div>
          </div>
        ) : (
          <section className="animate-fadeIn rounded-2xl border border-white/10 bg-gray-900/40 p-4 lg:sticky lg:top-4">
            <h3 className="text-sm font-black capitalize">
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' })}
              <span className="ml-2 text-xs font-normal text-gray-500">{dayOrders.length} · {formatMoney(daySum)}</span>
            </h3>
            {dayOrders.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">Sin ingresos este día.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {dayOrders.map((o) => (
                  <div key={o.id} onClick={rowClick(() => onOpen(o.id))}
                    className="cursor-pointer rounded-xl border border-white/10 bg-gray-950/40 p-3 transition-colors hover:border-blue-500/30">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${ORDER_STATUS[o.status].dot}`} />
                      <span className="truncate font-bold">{o.customers?.full_name ?? 'Sin cliente'}</span>
                      {o.vehicles?.license_plate && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-gray-300">{o.vehicles.license_plate}</span>}
                      {canDelete && <button onClick={() => onDelete(o)} title="Eliminar orden" className="ml-auto shrink-0 rounded-lg p-1 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                    {itemNames(o.work_order_items).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {itemNames(o.work_order_items).map((n, i) => <span key={i} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-gray-400">{n}</span>)}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS[o.status].color}`}>{ORDER_STATUS[o.status].label}</span>
                      <span className="text-sm font-black text-blue-300">{formatMoney(o.total_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------- Formulario Nueva orden (guiado) ---------- */
type VehOpt = { id: string; license_plate: string; make: string | null; model: string | null };
type CustomerOpt = { id: string; full_name: string; phone: string | null; vehicles: VehOpt[] };

function OrderForm({ organizationId, onClose, onSaved }: { organizationId: string; onClose: () => void; onSaved: () => void }) {
  useBodyScrollLock();
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [custQuery, setCustQuery] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const [vehMode, setVehMode] = useState<'existing' | 'new'>('existing');
  const [vehicleId, setVehicleId] = useState('');
  const [newVeh, setNewVeh] = useState({ license_plate: '', make: '', model: '', year: '', fuel_type: 'Diésel', vin: '' });

  const [lines, setLines] = useState<Line[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState<WorkOrderStatus>('pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([
        supabase.from('customers').select('id, full_name, phone, vehicles(id, license_plate, make, model)').eq('organization_id', organizationId).is('deleted_at', null).order('full_name'),
        supabase.from('services').select('id, name, base_price').eq('organization_id', organizationId).eq('is_active', true).is('deleted_at', null).order('name'),
      ]);
      setCustomers((cRes.data ?? []) as unknown as CustomerOpt[]);
      setServices((sRes.data ?? []) as ServiceOpt[]);
      setLoading(false);
    })();
  }, [organizationId]);

  useEffect(() => { setVehMode('existing'); setVehicleId(''); }, [customerId]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (comboRef.current && !comboRef.current.contains(e.target as Node)) setCustOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectedCust = customers.find((c) => c.id === customerId);
  const custVehicles = selectedCust?.vehicles ?? [];
  const effVehMode: 'existing' | 'new' = custVehicles.length === 0 ? 'new' : vehMode;
  const filteredCusts = useMemo(() => {
    const q = norm(custQuery.trim());
    const base = q ? customers.filter((c) => norm(c.full_name).includes(q) || (c.phone ?? '').includes(custQuery.trim())) : customers;
    return base.slice(0, 8);
  }, [customers, custQuery]);
  const total = linesTotal(lines);

  const save = async () => {
    if (!customerId) return toast.error('Selecciona un cliente');
    if (lines.length === 0) return toast.error('Agrega al menos un servicio');
    setSaving(true);
    try {
      const custId = customerId;
      // Vehículo (crear si es nuevo y tiene patente; opcional)
      let vehId: string | null = null;
      if (effVehMode === 'new') {
        if (newVeh.license_plate.trim()) {
          const { data, error } = await supabase.from('vehicles')
            .insert({ organization_id: organizationId, customer_id: custId, license_plate: newVeh.license_plate.trim().toUpperCase(), make: newVeh.make.trim() || null, model: newVeh.model.trim() || null, year: newVeh.year ? parseInt(newVeh.year, 10) : null, fuel_type: newVeh.fuel_type.trim() || null, vin: newVeh.vin.trim().toUpperCase() || null })
            .select('id').single();
          if (error) throw new Error(error.code === '23505' ? 'patente' : 'vehiculo');
          vehId = data.id;
        }
      } else {
        vehId = vehicleId || null;
      }
      // Orden + líneas en una sola transacción (RPC): código OT correlativo por taller,
      // atómico y sin carrera; el trigger recalc_work_order_total fija el total.
      const { data: created, error } = await createWorkOrder({
        customerId: custId,
        vehicleId: vehId,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt + 'T00:00:00').toISOString() : null,
        notes: notes.trim() || null,
        items: lines.map((l) => ({ service_id: l.service_id, description: l.description || 'Servicio', quantity: l.quantity, unit_price: l.unit_price })),
      });
      if (error || !created) throw new Error('orden');
      toast.success(`Orden ${created.code} creada`);
      onSaved();
    } catch (e: any) {
      const m: Record<string, string> = { patente: 'Esa patente ya existe en tu taller', vehiculo: 'No se pudo crear el vehículo' };
      toast.error(m[e?.message] || 'No se pudo crear la orden');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="animate-scaleIn max-h-[90vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-black">Nueva orden de servicio</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
        ) : (
          <div className="space-y-5">
            {/* 1. Cliente (buscar; se agregan en la sección Clientes) */}
            <Step n={1} title="Cliente">
              {customers.length === 0 ? (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                  No hay clientes todavía. Agrégalos primero en la sección Clientes.{' '}
                  <Link to="/clientes" onClick={onClose} className="font-bold underline">Ir a Clientes →</Link>
                </p>
              ) : (
                <div className="relative" ref={comboRef}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    value={selectedCust ? selectedCust.full_name : custQuery}
                    onChange={(e) => { setCustQuery(e.target.value); setCustomerId(''); setCustOpen(true); }}
                    onFocus={() => setCustOpen(true)}
                    placeholder="Buscar cliente por nombre o teléfono…"
                    className="inp !pl-9 text-sm" />
                  {selectedCust && (
                    <button type="button" onClick={() => { setCustomerId(''); setCustQuery(''); setCustOpen(true); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>
                  )}
                  {custOpen && !selectedCust && (
                    <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-gray-900 shadow-lg">
                      {filteredCusts.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-500">Sin resultados.</p>
                      ) : filteredCusts.map((c) => (
                        <button key={c.id} type="button" onMouseDown={() => { setCustomerId(c.id); setCustOpen(false); }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5">
                          <span className="truncate">{c.full_name}</span>
                          {c.phone && <span className="shrink-0 text-xs text-gray-500">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Step>

            {/* 2. Vehículo */}
            <Step n={2} title="Vehículo del cliente">
              {!customerId ? (
                <p className="text-xs text-gray-500">Completa el paso 1: al elegir el cliente aparecerán sus vehículos.</p>
              ) : effVehMode === 'existing' ? (
                <div className="flex gap-2">
                  <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="inp flex-1">
                    <option value="">Sin vehículo (se puede agregar después)</option>
                    {custVehicles.map((v) => <option key={v.id} value={v.id}>{v.license_plate} · {[v.make, v.model].filter(Boolean).join(' ')}</option>)}
                  </select>
                  <button type="button" onClick={() => setVehMode('new')} className="shrink-0 rounded-xl border border-white/10 px-3 text-xs font-bold hover:bg-white/5">+ Nuevo</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newVeh.license_plate} onChange={(e) => setNewVeh({ ...newVeh, license_plate: e.target.value.toUpperCase() })} placeholder="Patente" className="inp font-mono text-sm" />
                    <input value={newVeh.year} onChange={(e) => setNewVeh({ ...newVeh, year: e.target.value })} placeholder="Año" inputMode="numeric" className="inp text-sm" />
                  </div>
                  <SmartVehicleFields make={newVeh.make} model={newVeh.model} fuel={newVeh.fuel_type} onChange={(p) => setNewVeh({ ...newVeh, ...p })} />
                  <input value={newVeh.vin} onChange={(e) => setNewVeh({ ...newVeh, vin: e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 17) })}
                    placeholder="VIN (opcional) — para cotizar repuestos" maxLength={17} className="inp font-mono text-sm uppercase" />
                  {custVehicles.length > 0 && (
                    <button type="button" onClick={() => setVehMode('existing')} className="text-xs font-bold text-blue-400 hover:underline">Elegir un vehículo existente</button>
                  )}
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-gray-500">Opcional — puedes crear la orden sin vehículo.</p>
            </Step>

            {/* 3. Servicios */}
            <Step n={3} title="Servicios">
              <ServiceLinesEditor lines={lines} services={services} onChange={setLines} />
            </Step>

            {/* 4. Detalles */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <L label="¿Para qué día se agenda? (opcional)"><input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="inp" /></L>
              <L label="Estado">
                <select value={status} onChange={(e) => setStatus(e.target.value as WorkOrderStatus)} className="inp">
                  {ORDER_STATUS_ORDER.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
                </select>
              </L>
            </div>
            <L label="Notas (opcional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="inp resize-none" placeholder="Diagnóstico, observaciones…" /></L>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-gray-950/40 px-4 py-3">
              <span className="text-sm font-bold text-gray-400">Total</span>
              <span className="text-xl font-black text-blue-300">{formatMoney(total)}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold hover:bg-white/5">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Creando…' : 'Crear orden'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-500/15 text-[11px] font-black text-blue-300">{n}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</span>
      </div>
      {children}
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
