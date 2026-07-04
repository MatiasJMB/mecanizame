import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/api/client';
import { useAuth } from '../context/AuthContext';
import { useOrgGuard } from '@/hooks/useOrgGuard';
import { canDelete } from '../lib/roles';
import { useSearch } from '../context/SearchContext';
import { formatMoney, formatDate, norm } from '../lib/format';
import { ORDER_STATUS, type WorkOrderStatus } from '../lib/taller';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import SmartVehicleFields from '../components/SmartVehicleFields';
import OrderDetailModal from '../components/OrderDetailModal';
import PhoneInput from '../components/PhoneInput';
import { friendlyError } from '../lib/errors';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useConfirm } from '../components/ConfirmProvider';
import EmptyState from '../components/EmptyState';
import { Plus, Loader2, Car, Phone, Mail, User, Users, X, ChevronRight, Pencil, Trash2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

type Vehicle = {
  id: string; license_plate: string; make: string | null; model: string | null;
  year: number | null; engine: string | null; fuel_type: string | null; mileage: number | null; vin: string | null;
};
type Customer = {
  id: string; full_name: string; phone: string | null; email: string | null;
  notes: string | null; vehicles: Vehicle[];
};
type HistoryOrder = {
  id: string; code: string | null; status: WorkOrderStatus; total_amount: number;
  created_at: string; vehicle_id: string | null;
  work_order_items: { id: string; description: string | null; services: { name: string } | null }[];
};

export default function Clientes() {
  const { organizationId, role, isSuperAdmin } = useAuth();
  const isFresh = useOrgGuard();
  const canDel = isSuperAdmin || canDelete(role);
  const confirm = useConfirm();
  const { query, setQuery } = useSearch();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customerModal, setCustomerModal] = useState<Customer | 'new' | null>(null);
  const [vehicleModal, setVehicleModal] = useState<{ customerId: string; vehicle?: Vehicle } | null>(null);

  useEffect(() => { document.title = 'Clientes — Mecanízame'; }, []);

  const load = async () => {
    if (!organizationId) return;
    const oid = organizationId;
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('id, full_name, phone, email, notes, vehicles(id, license_plate, make, model, year, engine, fuel_type, mileage, vin)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (!isFresh(oid)) return;
    setCustomers((data ?? []) as unknown as Customer[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return customers;
    return customers.filter((c) =>
      norm(c.full_name).includes(q) ||
      (c.phone ?? '').includes(query.trim()) ||
      c.vehicles.some((v) => norm(v.license_plate).includes(q)));
  }, [customers, query]);

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const deleteCustomer = async (c: Customer) => {
    const ok = await confirm({ title: `Eliminar a ${c.full_name}`, message: 'Se ocultará de la lista; su historial de órdenes se conserva.', confirmText: 'Eliminar cliente' });
    if (!ok) return;
    const { error } = await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', c.id);
    if (error) return toast.error(friendlyError(error, 'No se pudo eliminar el cliente'));
    if (selectedId === c.id) setSelectedId(null);
    toast.success('Cliente eliminado');
    load();
  };
  const deleteVehicle = async (v: Vehicle) => {
    const ok = await confirm({ title: `Eliminar vehículo ${v.license_plate}`, message: 'Su historial de órdenes se conserva.', confirmText: 'Eliminar vehículo' });
    if (!ok) return;
    const { error } = await supabase.from('vehicles').update({ deleted_at: new Date().toISOString() }).eq('id', v.id);
    if (error) return toast.error(friendlyError(error, 'No se pudo eliminar el vehículo'));
    toast.success('Vehículo eliminado');
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" subtitle="Cada cliente con sus vehículos e historial por patente." help={HELP.clientes}>
        <button onClick={() => setCustomerModal('new')} data-tour="nuevo-cliente"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-500">
          <Plus className="h-4 w-4" /> Nuevo cliente
        </button>
      </PageHeader>

      <div className="grid gap-6 lg:h-[calc(100vh-15rem)] lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Lista */}
        <div className="custom-scrollbar space-y-2 lg:overflow-y-auto lg:pr-1">
          {filtered.length === 0 && (
            customers.length === 0 ? (
              <EmptyState compact icon={Users} title="Aún no tienes clientes"
                description="Parte registrando a tu primer cliente. Después le agregas su vehículo y podrás crearle órdenes de trabajo."
                action={{ label: 'Nuevo cliente', onClick: () => setCustomerModal('new'), icon: <Plus className="h-4 w-4" /> }} />
            ) : (
              <EmptyState compact icon={Users} title={`Nadie calza con «${query}»`}
                description="Revisa el nombre, el teléfono o la patente."
                secondary={{ label: 'Limpiar búsqueda', onClick: () => setQuery('') }} />
            )
          )}
          {filtered.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${selectedId === c.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-gray-900/40 hover:bg-gray-900/60'}`}>
              <div className="min-w-0">
                <p className="truncate font-bold">{c.full_name}</p>
                <p className="truncate text-xs text-gray-400">
                  {c.phone || 'sin teléfono'} · {c.vehicles.length} {c.vehicles.length === 1 ? 'vehículo' : 'vehículos'}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
            </button>
          ))}
        </div>

        {/* Detalle 360 */}
        <div className="custom-scrollbar lg:overflow-y-auto">
          {!selected ? (
            <div className="grid h-full min-h-[200px] place-items-center rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">
              <div><User className="mx-auto mb-2 h-8 w-8 text-gray-600" />Elige un cliente de la lista para ver sus datos, vehículos e historial de trabajos.</div>
            </div>
          ) : (
            <CustomerDetail
              customer={selected}
              onEditCustomer={() => setCustomerModal(selected)}
              onDeleteCustomer={() => deleteCustomer(selected)}
              onAddVehicle={() => setVehicleModal({ customerId: selected.id })}
              onEditVehicle={(v) => setVehicleModal({ customerId: selected.id, vehicle: v })}
              onDeleteVehicle={deleteVehicle}
              canDelete={canDel}
            />
          )}
        </div>
      </div>

      {customerModal && (
        <CustomerForm organizationId={organizationId!}
          customer={customerModal === 'new' ? undefined : customerModal}
          onClose={() => setCustomerModal(null)}
          onSaved={(id) => { setCustomerModal(null); load().then(() => setSelectedId(id)); }} />
      )}
      {vehicleModal && (
        <VehicleForm organizationId={organizationId!} customerId={vehicleModal.customerId} vehicle={vehicleModal.vehicle}
          onClose={() => setVehicleModal(null)} onSaved={() => { setVehicleModal(null); load(); }} />
      )}
    </div>
  );
}

function CustomerDetail({ customer, onEditCustomer, onDeleteCustomer, onAddVehicle, onEditVehicle, onDeleteVehicle, canDelete }: {
  customer: Customer; onEditCustomer: () => void; onDeleteCustomer: () => void; onAddVehicle: () => void;
  onEditVehicle: (v: Vehicle) => void; onDeleteVehicle: (v: Vehicle) => void; canDelete: boolean;
}) {
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [copiedVin, setCopiedVin] = useState<string | null>(null);
  const copyVin = async (vin: string) => {
    try { await navigator.clipboard.writeText(vin); setCopiedVin(vin); setTimeout(() => setCopiedVin(null), 1500); } catch { /* noop */ }
  };

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('work_orders')
      .select('id, code, status, total_amount, created_at, vehicle_id, work_order_items(id, description, services(name))')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    setHistory((data ?? []) as unknown as HistoryOrder[]);
    setLoading(false);
  }, [customer.id]);

  useEffect(() => { setLoading(true); loadHistory(); }, [loadHistory]);

  const byVehicle = (vehicleId: string) => history.filter((h) => h.vehicle_id === vehicleId);

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-gray-900/40 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-black">{customer.full_name}</h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-400">
            {customer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
          </div>
          {customer.notes && <p className="mt-2 text-sm text-gray-500">{customer.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEditCustomer} title="Editar cliente" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"><Pencil className="h-4 w-4" /></button>
          {canDelete && <button onClick={onDeleteCustomer} title="Eliminar cliente" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Vehículos</h3>
        <button onClick={onAddVehicle} className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Agregar vehículo
        </button>
      </div>

      {customer.vehicles.length === 0 ? (
        <EmptyState compact icon={Car} title="Este cliente no tiene vehículos"
          description="Agrégale su vehículo con la patente: así queda el historial de trabajos por auto."
          action={{ label: 'Agregar vehículo', onClick: onAddVehicle, icon: <Plus className="h-4 w-4" /> }} />
      ) : (
        <div className="space-y-4">
          {customer.vehicles.map((v) => {
            const orders = byVehicle(v.id);
            return (
              <div key={v.id} className="rounded-xl border border-white/10 bg-gray-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-blue-400" />
                    <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-sm font-bold tracking-wider">{v.license_plate}</span>
                    <span className="text-sm text-gray-300">{[v.make, v.model, v.year].filter(Boolean).join(' ') || 'Vehículo'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {[v.fuel_type, v.engine, v.mileage ? `${v.mileage.toLocaleString('es-CL')} km` : null].filter(Boolean).join(' · ')}
                    </span>
                    <button onClick={() => onEditVehicle(v)} title="Editar vehículo" className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                    {canDelete && <button onClick={() => onDeleteVehicle(v)} title="Eliminar vehículo" className="rounded-lg p-1 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>

                {v.vin && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">VIN</span>
                    <code className="font-mono text-xs text-gray-300">{v.vin}</code>
                    <button onClick={() => copyVin(v.vin!)} title="Copiar VIN para cotizar repuestos"
                      className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/5 hover:text-blue-300">
                      {copiedVin === v.vin ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}

                {/* Historial por patente */}
                <div className="mt-3 border-t border-white/5 pt-3">
                  {loading ? (
                    <p className="text-xs text-gray-500">Cargando historial…</p>
                  ) : orders.length === 0 ? (
                    <p className="text-xs text-gray-500">Sin servicios registrados para esta patente.</p>
                  ) : (
                    <ul className="space-y-1">
                      {orders.map((o) => (
                        <li key={o.id}>
                          <button onClick={() => setDetailId(o.id)} title="Ver detalle de la orden"
                            className="-mx-2 flex w-full items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5">
                            <div className="min-w-0">
                              <p className="truncate text-sm">
                                {o.work_order_items.map((i) => i.services?.name || i.description).filter(Boolean).join(', ') || 'Orden de servicio'}
                              </p>
                              <p className="text-[11px] text-gray-500">{formatDate(o.created_at)} · {o.code ?? '—'}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-sm font-bold">{formatMoney(o.total_amount)}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS[o.status].color}`}>{ORDER_STATUS[o.status].label}</span>
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-gray-600" />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailId && (
        <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)}
          onChanged={loadHistory} onDeleted={() => { setDetailId(null); loadHistory(); }} />
      )}
    </div>
  );
}

/* ---------- Formularios ---------- */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="animate-scaleIn max-h-[90vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, ...rest }: {
  label: string; value: string; onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="space-y-1.5">
      <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="inp" {...rest} />
    </div>
  );
}

function CustomerForm({ organizationId, customer, onClose, onSaved }: {
  organizationId: string; customer?: Customer; onClose: () => void; onSaved: (id: string) => void;
}) {
  const editing = !!customer;
  const [f, setF] = useState({
    full_name: customer?.full_name ?? '', phone: customer?.phone ?? '', email: customer?.email ?? '', notes: customer?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.full_name.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    const payload = { full_name: f.full_name.trim(), phone: f.phone.trim() || null, email: f.email.trim() || null, notes: f.notes.trim() || null };
    const { data, error } = editing
      ? await supabase.from('customers').update(payload).eq('id', customer!.id).select('id').single()
      : await supabase.from('customers').insert({ organization_id: organizationId, ...payload }).select('id').single();
    setSaving(false);
    if (error || !data) return toast.error(friendlyError(error, 'No se pudo guardar el cliente'));
    toast.success(editing ? 'Cliente actualizado' : 'Cliente creado');
    onSaved(data.id);
  };

  return (
    <Modal title={editing ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre y apellido" value={f.full_name} onChange={(v) => setF({ ...f, full_name: v })} placeholder="Ej: Juan Pérez" autoFocus />
        <div className="space-y-1.5">
          <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Teléfono</label>
          <PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
        </div>
        <Field label="Correo" value={f.email} onChange={(v) => setF({ ...f, email: v })} placeholder="correo@ejemplo.cl (opcional)" type="email" />
        <Field label="Notas" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} placeholder="Ej: cliente de flota, paga a fin de mes (opcional)" />
      </div>
      <FormButtons saving={saving} onCancel={onClose} onSave={save} />
    </Modal>
  );
}

function VehicleForm({ organizationId, customerId, vehicle, onClose, onSaved }: {
  organizationId: string; customerId: string; vehicle?: Vehicle; onClose: () => void; onSaved: () => void;
}) {
  const editing = !!vehicle;
  const [f, setF] = useState({
    license_plate: vehicle?.license_plate ?? '', make: vehicle?.make ?? '', model: vehicle?.model ?? '',
    year: vehicle?.year ? String(vehicle.year) : '', engine: vehicle?.engine ?? '',
    fuel_type: vehicle?.fuel_type ?? 'Diésel', mileage: vehicle?.mileage ? String(vehicle.mileage) : '',
    vin: vehicle?.vin ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.license_plate.trim()) return toast.error('La patente es obligatoria');
    setSaving(true);
    const payload = {
      license_plate: f.license_plate.trim().toUpperCase(),
      make: f.make.trim() || null, model: f.model.trim() || null,
      year: f.year ? parseInt(f.year, 10) : null, engine: f.engine.trim() || null,
      fuel_type: f.fuel_type.trim() || null,
      mileage: f.mileage ? parseInt(f.mileage.replace(/\D/g, ''), 10) : null,
      vin: f.vin.trim().toUpperCase() || null,
    };
    const { error } = editing
      ? await supabase.from('vehicles').update(payload).eq('id', vehicle!.id)
      : await supabase.from('vehicles').insert({ organization_id: organizationId, customer_id: customerId, ...payload });
    setSaving(false);
    if (error) return toast.error(error.code === '23505' ? 'Esa patente ya existe en tu taller' : friendlyError(error, 'No se pudo guardar el vehículo'));
    toast.success(editing ? 'Vehículo actualizado' : 'Vehículo agregado');
    onSaved();
  };

  return (
    <Modal title={editing ? 'Editar vehículo' : 'Nuevo vehículo'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Patente" value={f.license_plate} onChange={(v) => setF({ ...f, license_plate: v })} placeholder="Ej: GFKL52 · con o sin guión" autoFocus />
        <SmartVehicleFields labeled make={f.make} model={f.model} fuel={f.fuel_type} onChange={(p) => setF({ ...f, ...p })} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Año" value={f.year} onChange={(v) => setF({ ...f, year: v })} placeholder="2018" inputMode="numeric" />
          <Field label="Motor" value={f.engine} onChange={(v) => setF({ ...f, engine: v })} placeholder="2.4 D4D" />
          <Field label="Km" value={f.mileage} onChange={(v) => setF({ ...f, mileage: v })} placeholder="120000" inputMode="numeric" />
        </div>
        <div className="space-y-1.5">
          <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">VIN (opcional)</label>
          <input value={f.vin} onChange={(e) => setF({ ...f, vin: e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 17) })}
            placeholder="Ej: 9BWZZZ377VT004251" maxLength={17}
            className="inp font-mono uppercase tracking-wide" />
          <p className="ml-1 text-[11px] text-gray-500">Los 17 caracteres del parabrisas o el permiso de circulación. Sirve para cotizar los repuestos exactos del vehículo.</p>
        </div>
      </div>
      <FormButtons saving={saving} onCancel={onClose} onSave={save} />
    </Modal>
  );
}

function FormButtons({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="mt-6 flex gap-2">
      <button onClick={onCancel} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold hover:bg-white/5">Cancelar</button>
      <button onClick={onSave} disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-black hover:bg-blue-500 disabled:opacity-50">
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}
