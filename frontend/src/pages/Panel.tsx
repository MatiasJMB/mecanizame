import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney, formatDate } from '../lib/format';
import { ORDER_STATUS, ORDER_STATUS_ORDER, type WorkOrderStatus } from '../lib/taller';
import { Users, Car, Wrench, ClipboardList, Loader2, TrendingUp } from 'lucide-react';

type Kpis = {
  revenueMonth: number;
  customers: number;
  vehicles: number;
  services: number;
  byStatus: Record<WorkOrderStatus, number>;
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
  const { organizationId, organizationName } = useAuth();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Resumen — Taller Mecánico'; }, []);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      setLoading(true);
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

      const byStatus: Record<WorkOrderStatus, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
      let revenueMonth = 0;
      for (const o of ordersR.data ?? []) {
        byStatus[o.status as WorkOrderStatus] = (byStatus[o.status as WorkOrderStatus] ?? 0) + 1;
        if (o.status === 'completed' && new Date(o.created_at) >= monthStart) revenueMonth += o.total_amount ?? 0;
      }

      setKpis({
        revenueMonth,
        customers: customersR.count ?? 0,
        vehicles: vehiclesR.count ?? 0,
        services: servicesR.count ?? 0,
        byStatus,
      });
      setRecent((recentR.data ?? []) as unknown as RecentOrder[]);
      setLoading(false);
    })();
  }, [organizationId]);

  if (loading || !kpis) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  const activeOrders = kpis.byStatus.pending + kpis.byStatus.in_progress;
  const totalOrders = ORDER_STATUS_ORDER.reduce((a, s) => a + kpis.byStatus[s], 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black">Hola, {organizationName || 'tu taller'} 👋</h1>
        <p className="mt-1 text-sm text-gray-400">Resumen de tu operación.</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Ingresos del mes" value={formatMoney(kpis.revenueMonth)} accent />
        <Kpi icon={Users} label="Clientes" value={String(kpis.customers)} to="/clientes" />
        <Kpi icon={Car} label="Vehículos" value={String(kpis.vehicles)} to="/clientes" />
        <Kpi icon={ClipboardList} label="Órdenes activas" value={String(activeOrders)} to="/ordenes" />
      </div>

      {/* Órdenes por estado */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Órdenes por estado</h2>
          <Link to="/ordenes" className="text-xs font-bold text-blue-400 hover:underline">Ver todas →</Link>
        </div>
        {totalOrders === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay órdenes de servicio.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ORDER_STATUS_ORDER.map((s) => (
              <div key={s} className={`rounded-xl border px-4 py-3 ${ORDER_STATUS[s].color}`}>
                <p className="text-2xl font-black">{kpis.byStatus[s]}</p>
                <p className="text-xs font-bold">{ORDER_STATUS[s].label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Servicios activos + recientes */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Órdenes recientes</h2>
          <span className="flex items-center gap-1.5 text-xs text-gray-400"><Wrench className="h-3.5 w-3.5" /> {kpis.services} servicios activos</span>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">Cuando registres órdenes, aparecerán aquí.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2.5">
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent, to }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean; to?: string;
}) {
  const inner = (
    <div className={`rounded-2xl border p-5 transition-colors ${accent ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/10 bg-gray-900/40 hover:bg-gray-900/60'}`}>
      <Icon className={`h-5 w-5 ${accent ? 'text-blue-400' : 'text-gray-500'}`} />
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
