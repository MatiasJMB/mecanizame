import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney, formatDate } from '../lib/format';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import { Loader2, Building2, Users, Car, ClipboardList, TrendingUp } from 'lucide-react';

type Org = { id: string; name: string; slug: string | null; plan: string | null; is_active: boolean; created_at: string };
type Agg = { customers: number; vehicles: number; orders: number; revenue: number };

export default function Admin() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [agg, setAgg] = useState<Record<string, Agg>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Talleres — Administración'; }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      setLoading(true);
      // Super admin ve todo (RLS: is_super_admin() en las policies).
      const [orgsR, custR, vehR, ordR] = await Promise.all([
        supabase.from('organizations').select('id, name, slug, plan, is_active, created_at').order('created_at'),
        supabase.from('customers').select('organization_id').is('deleted_at', null),
        supabase.from('vehicles').select('organization_id').is('deleted_at', null),
        supabase.from('work_orders').select('organization_id, status, total_amount'),
      ]);

      const a: Record<string, Agg> = {};
      const ensure = (id: string) => (a[id] ??= { customers: 0, vehicles: 0, orders: 0, revenue: 0 });
      for (const c of custR.data ?? []) ensure(c.organization_id).customers++;
      for (const v of vehR.data ?? []) ensure(v.organization_id).vehicles++;
      for (const o of ordR.data ?? []) {
        const x = ensure(o.organization_id);
        x.orders++;
        if (o.status === 'completed') x.revenue += o.total_amount ?? 0;
      }
      setOrgs((orgsR.data ?? []) as Org[]);
      setAgg(a);
      setLoading(false);
    })();
  }, [isSuperAdmin]);

  const totals = useMemo(() => {
    const t = { orgs: orgs.length, customers: 0, orders: 0, revenue: 0 };
    for (const id in agg) { t.customers += agg[id].customers; t.orders += agg[id].orders; t.revenue += agg[id].revenue; }
    return t;
  }, [orgs, agg]);

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Talleres de la plataforma"
        subtitle="Vista de Super Admin: todos los talleres registrados y sus métricas."
        help={HELP.admin}
      />

      {/* Totales de plataforma */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Building2} label="Talleres" value={String(totals.orgs)} accent />
        <Kpi icon={Users} label="Clientes (total)" value={String(totals.customers)} />
        <Kpi icon={ClipboardList} label="Órdenes (total)" value={String(totals.orders)} />
        <Kpi icon={TrendingUp} label="Ingresos (total)" value={formatMoney(totals.revenue)} />
      </div>

      {/* Talleres */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">Talleres registrados</h2>
        {orgs.map((o) => {
          const m = agg[o.id] ?? { customers: 0, vehicles: 0, orders: 0, revenue: 0 };
          return (
            <div key={o.id} className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-black">{o.name}</p>
                    <p className="text-[11px] text-gray-500">
                      Plan {o.plan ?? 'free'} · desde {formatDate(o.created_at)}
                      {!o.is_active && ' · inactivo'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-blue-300">{formatMoney(m.revenue)}</p>
                  <p className="text-[11px] text-gray-500">ingresos completados</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Metric icon={Users} label="Clientes" value={m.customers} />
                <Metric icon={Car} label="Vehículos" value={m.vehicles} />
                <Metric icon={ClipboardList} label="Órdenes" value={m.orders} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/10 bg-gray-900/40'}`}>
      <Icon className={`h-5 w-5 ${accent ? 'text-blue-400' : 'text-gray-500'}`} />
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-gray-950/40 px-3 py-2.5">
      <Icon className="h-4 w-4 text-gray-500" />
      <div>
        <p className="text-sm font-black leading-none">{value}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      </div>
    </div>
  );
}
