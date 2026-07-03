import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/api/client';
import { useAuth } from '../context/AuthContext';
import { formatMoney, formatDate } from '../lib/format';
import { ORDER_STATUS, ACTIVE_STATUSES, type WorkOrderStatus } from '../lib/taller';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import OrderDetailModal from '../components/OrderDetailModal';
import OnboardingChecklist from '../components/OnboardingChecklist';
import EmptyState from '../components/EmptyState';
import { Users, Car, ClipboardList, Loader2, TrendingUp } from 'lucide-react';

type Kpis = {
  revenueMonth: number;
  customers: number;
  vehicles: number;
  services: number;
  activeOrders: number;
  totalOrders: number;
};

type RecentOrder = {
  id: string;
  code: string | null;
  status: WorkOrderStatus;
  total_amount: number;
  created_at: string;
  customers: { full_name: string } | null;
  vehicles: { license_plate: string } | null;
};

export default function Panel() {
  const { organizationId } = useAuth();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => { document.title = 'Resumen — Mecanízame'; }, []);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [customersR, vehiclesR, servicesR, ordersR, recentR] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true).is('deleted_at', null),
      supabase.from('work_orders').select('status, total_amount, created_at').eq('organization_id', organizationId),
      supabase.from('work_orders').select('id, code, status, total_amount, created_at, customers(full_name), vehicles(license_plate)').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(6),
    ]);

    let revenueMonth = 0;
    let activeOrders = 0;
    const all = ordersR.data ?? [];
    for (const o of all) {
      if (ACTIVE_STATUSES.includes(o.status as WorkOrderStatus)) activeOrders++;
      if (o.status === 'completed' && new Date(o.created_at) >= monthStart) revenueMonth += o.total_amount ?? 0;
    }

    setKpis({
      revenueMonth,
      customers: customersR.count ?? 0,
      vehicles: vehiclesR.count ?? 0,
      services: servicesR.count ?? 0,
      activeOrders,
      totalOrders: all.length,
    });
    setRecent((recentR.data ?? []) as unknown as RecentOrder[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !kpis) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen"
        subtitle="Vista general de tu taller: ingresos del mes, clientes, vehículos y estado de las órdenes."
        help={HELP.resumen}
      />

      <OnboardingChecklist services={kpis.services} customers={kpis.customers} orders={kpis.totalOrders} />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="kpis">
        <Kpi icon={TrendingUp} label="Ingresos del mes" hint="Solo órdenes terminadas" value={formatMoney(kpis.revenueMonth)} accent big />
        <Kpi icon={Users} label="Clientes" value={String(kpis.customers)} to="/clientes" />
        <Kpi icon={Car} label="Vehículos" value={String(kpis.vehicles)} to="/clientes" />
        <Kpi icon={ClipboardList} label="Órdenes activas" value={String(kpis.activeOrders)} to="/ordenes" />
      </div>

      {/* Servicios activos + recientes */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Órdenes recientes</h2>
          <Link to="/ordenes" className="text-xs font-bold text-blue-400 hover:underline">Ver todas →</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState compact icon={ClipboardList} title="Aún no hay órdenes"
            description="Cuando registres órdenes de trabajo, aquí verás las últimas." />
        ) : (
          <div className="divide-y divide-white/5">
            {recent.map((o) => (
              <button key={o.id} onClick={() => setDetailId(o.id)} title="Ver detalle de la orden"
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-white/5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{o.customers?.full_name ?? 'Sin cliente'}
                    {o.vehicles?.license_plate && <span className="ml-2 text-xs font-mono text-gray-400">{o.vehicles.license_plate}</span>}
                  </p>
                  <p className="text-[11px] text-gray-500">{o.code ?? '—'} · {formatDate(o.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-black">{formatMoney(o.total_amount)}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS[o.status].color}`}>
                    {ORDER_STATUS[o.status].label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {detailId && (
        <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)}
          onChanged={load} onDeleted={() => { setDetailId(null); load(); }} />
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent, to, hint, big }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean; to?: string; hint?: string; big?: boolean;
}) {
  const inner = (
    <div className={`rounded-2xl border p-5 transition-colors ${accent ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/10 bg-gray-900/40 hover:bg-gray-900/60'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="card-label">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${accent ? 'text-blue-400' : 'text-gray-600'}`} />
      </div>
      <p className={`mt-2 font-black text-white ${big ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
