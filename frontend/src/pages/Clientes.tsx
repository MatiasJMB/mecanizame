import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney, formatDate } from '../lib/format';
import { ORDER_STATUS, type WorkOrderStatus } from '../lib/taller';
import { Plus, Search, Loader2, Car, Phone, Mail, User, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

type Vehicle = {
  id: string; license_plate: string; make: string | null; model: string | null;
  year: number | null; engine: string | null; fuel_type: string | null; mileage: number | null;
};
type Customer = {
  id: string; full_name: string; phone: string | null; email: string | null;
  address: string | null; notes: string | null; vehicles: Vehicle[];
};
type HistoryOrder = {
  id: string; code: string | null; status: WorkOrderStatus; total_amount: number;
  created_at: string; vehicle_id: string | null;
  work_order_items: { id: string; description: string | null; services: { name: string } | null }[];
};

export default function Clientes() {
  const { organizationId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState(false);
  const [vehicleForCustomer, setVehicleForCustomer] = useState<string | null>(null);

  useEffect(() => { document.title = 'Clientes — Taller Mecánico'; }, []);

  const load = async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('id, full_name, phone, email, address, notes, vehicles(id, license_plate, make, model, year, engine, fuel_type, mileage)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setCustomers((data ?? []) as unknown as Customer[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.full_name.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      c.vehicles.some((v) => v.license_plate.toLowerCase().includes(q)));
  }, [customers, query]);

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Clientes</h1>
          <p className="mt-1 text-sm text-gray-400">Cada cliente con sus vehículos e historial por patente.</p>
        </div>
        <button onClick={() => setCustomerForm(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black hover:bg-blue-500">
          <Plus className="h-4 w-4" /> Nuevo cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, teléfono o patente…"
          className="w-full rounded-xl border border-white/10 bg-gray-950/60 py-2.5 pl-9 pr-3 text-sm placeholder:text-gray-600 focus:outline-none" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Lista */}
        <div className="space-y-2">
          {filtered.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">Sin resultados.</p>}
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
        <div>
          {!selected ? (
            <div className="grid h-full min-h-[200px] place-items-center rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">
              <div><User className="mx-auto mb-2 h-8 w-8 text-gray-600" />Selecciona un cliente para ver su ficha 360.</div>
            </div>
          ) : (
            <CustomerDetail
              customer={selected}
              onAddVehicle={() => setVehicleForCustomer(selected.id)}
              onChanged={load}
            />
          )}
        </div>
      </div>

      {customerForm && (
        <CustomerForm organizationId={organizationId!} onClose={() => setCustomerForm(false)}
          onSaved={(id) => { setCustomerForm(false); load().then(() => setSelectedId(id)); }} />
      )}
      {vehicleForCustomer && (
        <VehicleForm organizationId={organizationId!} customerId={vehicleForCustomer}
          onClose={() => setVehicleForCustomer(null)} onSaved={() => { setVehicleForCustomer(null); load(); }} />
      )}
    </div>
  );
}

function CustomerDetail({ customer, onAddVehicle }: { customer: Customer; onAddVehicle: () => void; onChanged: () => void }) {
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('work_orders')
        .select('id, code, status, total_amount, created_at, vehicle_id, work_order_items(id, description, services(name))')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      setHistory((data ?? []) as unknown as HistoryOrder[]);
      setLoading(false);
    })();
  }, [customer.id]);

  const byVehicle = (vehicleId: string) => history.filter((h) => h.vehicle_id === vehicleId);

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-gray-900/40 p-5">
      <div>
        <h2 className="text-xl font-black">{customer.full_name}</h2>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-400">
          {customer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>}
          {customer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
        </div>
        {customer.notes && <p className="mt-2 text-sm text-gray-500">{customer.notes}</p>}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Vehículos</h3>
        <button onClick={onAddVehicle} className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Agregar vehículo
        </button>
      </div>

      {customer.vehicles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-gray-500">Sin vehículos registrados.</p>
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
                  <span className="text-xs text-gray-500">
                    {[v.fuel_type, v.engine, v.mileage ? `${v.mileage.toLocaleString('es-CL')} km` : null].filter(Boolean).join(' · ')}
                  </span>
                </div>

                {/* Historial por patente */}
                <div className="mt-3 border-t border-white/5 pt-3">
                  {loading ? (
                    <p className="text-xs text-gray-500">Cargando historial…</p>
                  ) : orders.length === 0 ? (
                    <p className="text-xs text-gray-500">Sin servicios registrados para esta patente.</p>
                  ) : (
                    <ul className="space-y-2">
                      {orders.map((o) => (
                        <li key={o.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm">
                              {o.work_order_items.map((i) => i.services?.name || i.description).filter(Boolean).join(', ') || 'Orden de servicio'}
                            </p>
                            <p className="text-[11px] text-gray-500">{formatDate(o.created_at)} · {o.code ?? '—'}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-bold">{formatMoney(o.total_amount)}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS[o.status].color}`}>{ORDER_STATUS[o.status].label}</span>
                          </div>
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
    </div>
  );
}

/* ---------- Formularios ---------- */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
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

function CustomerForm({ organizationId, onClose, onSaved }: {
  organizationId: string; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [f, setF] = useState({ full_name: '', phone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.full_name.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    const { data, error } = await supabase.from('customers').insert({
      organization_id: organizationId,
      full_name: f.full_name.trim(),
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      notes: f.notes.trim() || null,
    }).select('id').single();
    setSaving(false);
    if (error || !data) return toast.error('No se pudo guardar');
    toast.success('Cliente creado');
    onSaved(data.id);
  };

  return (
    <Modal title="Nuevo cliente" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre" value={f.full_name} onChange={(v) => setF({ ...f, full_name: v })} placeholder="Ej: Juan Pérez" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} placeholder="+56 9 …" inputMode="tel" />
          <Field label="Correo" value={f.email} onChange={(v) => setF({ ...f, email: v })} placeholder="opcional" type="email" />
        </div>
        <Field label="Notas" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} placeholder="Opcional" />
      </div>
      <FormButtons saving={saving} onCancel={onClose} onSave={save} />
    </Modal>
  );
}

function VehicleForm({ organizationId, customerId, onClose, onSaved }: {
  organizationId: string; customerId: string; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState({ license_plate: '', make: '', model: '', year: '', engine: '', fuel_type: 'Diésel', mileage: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.license_plate.trim()) return toast.error('La patente es obligatoria');
    setSaving(true);
    const { error } = await supabase.from('vehicles').insert({
      organization_id: organizationId,
      customer_id: customerId,
      license_plate: f.license_plate.trim().toUpperCase(),
      make: f.make.trim() || null,
      model: f.model.trim() || null,
      year: f.year ? parseInt(f.year, 10) : null,
      engine: f.engine.trim() || null,
      fuel_type: f.fuel_type.trim() || null,
      mileage: f.mileage ? parseInt(f.mileage.replace(/\D/g, ''), 10) : null,
    });
    setSaving(false);
    if (error) return toast.error(error.code === '23505' ? 'Esa patente ya existe en tu taller' : 'No se pudo guardar');
    toast.success('Vehículo agregado');
    onSaved();
  };

  return (
    <Modal title="Nuevo vehículo" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Patente" value={f.license_plate} onChange={(v) => setF({ ...f, license_plate: v })} placeholder="Ej: GFKL-52" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marca" value={f.make} onChange={(v) => setF({ ...f, make: v })} placeholder="Ej: Toyota" />
          <Field label="Modelo" value={f.model} onChange={(v) => setF({ ...f, model: v })} placeholder="Ej: Hilux" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Año" value={f.year} onChange={(v) => setF({ ...f, year: v })} placeholder="2018" inputMode="numeric" />
          <Field label="Motor" value={f.engine} onChange={(v) => setF({ ...f, engine: v })} placeholder="2.4 D4D" />
          <Field label="Km" value={f.mileage} onChange={(v) => setF({ ...f, mileage: v })} placeholder="120000" inputMode="numeric" />
        </div>
        <Field label="Combustible" value={f.fuel_type} onChange={(v) => setF({ ...f, fuel_type: v })} placeholder="Diésel" />
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
