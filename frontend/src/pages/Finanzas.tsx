import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/format';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import { Loader2, TrendingUp, Receipt, Wallet, CalendarRange } from 'lucide-react';

type CompletedOrder = {
  total_amount: number;
  created_at: string;
  work_order_items: { subtotal: number; description: string | null; services: { name: string } | null }[];
};

type Preset = 'month' | 'lastMonth' | 'q' | 'year' | 'custom';

const monthLabel = (d: Date) => d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');

function rangeFor(preset: Preset, from: string, to: string): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (preset === 'month') return [start, now];
  if (preset === 'lastMonth') return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)];
  if (preset === 'q') return [new Date(now.getFullYear(), now.getMonth() - 2, 1), now];
  if (preset === 'year') return [new Date(now.getFullYear(), 0, 1), now];
  return [from ? new Date(from) : start, to ? new Date(to + 'T23:59:59') : now];
}

export default function Finanzas() {
  const { organizationId } = useAuth();
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { document.title = 'Finanzas — Taller Mecánico'; }, []);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('work_orders')
        .select('total_amount, created_at, work_order_items(subtotal, description, services(name))')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .order('created_at');
      setOrders((data ?? []) as unknown as CompletedOrder[]);
      setLoading(false);
    })();
  }, [organizationId]);

  const [start, end] = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);

  const inRange = useMemo(
    () => orders.filter((o) => { const d = new Date(o.created_at); return d >= start && d <= end; }),
    [orders, start, end],
  );

  const revenue = inRange.reduce((a, o) => a + (o.total_amount ?? 0), 0);
  const count = inRange.length;
  const avg = count ? Math.round(revenue / count) : 0;

  // Serie mensual (últimos 6 meses) sobre TODO el histórico completado
  const monthly = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; key: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ label: monthLabel(d), key: `${d.getFullYear()}-${d.getMonth()}`, value: 0 });
    }
    for (const o of orders) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((x) => x.key === key);
      if (b) b.value += o.total_amount ?? 0;
    }
    return buckets;
  }, [orders]);
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.value));

  // Top servicios por ingreso en el rango
  const topServices = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of inRange) {
      for (const it of o.work_order_items ?? []) {
        const name = it.services?.name || it.description || 'Otro';
        map.set(name, (map.get(name) ?? 0) + (it.subtotal ?? 0));
      }
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [inRange]);
  const maxService = Math.max(1, ...topServices.map((s) => s.value));

  const PRESETS: [Preset, string][] = [['month', 'Este mes'], ['lastMonth', 'Mes pasado'], ['q', 'Últimos 3 meses'], ['year', 'Este año'], ['custom', 'Personalizado']];

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Finanzas" subtitle="Ingresos y ventas del taller. Solo cuentan las órdenes completadas." help={HELP.finanzas} />

      {/* Selector de período */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(([p, label]) => (
          <button key={p} onClick={() => setPreset(p)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${preset === p ? 'border-blue-500/50 bg-blue-500/15 text-blue-300' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}>
            {label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <CalendarRange className="h-4 w-4" />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="inp !w-auto !py-1.5" />
            <span>a</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="inp !w-auto !py-1.5" />
          </div>
        )}
      </div>

      {/* KPIs del período */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={TrendingUp} label="Ingresos del período" value={formatMoney(revenue)} accent />
        <Kpi icon={Receipt} label="Trabajos completados" value={String(count)} />
        <Kpi icon={Wallet} label="Ticket promedio" value={formatMoney(avg)} />
      </div>

      {/* Gráfico mensual */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
        <h2 className="mb-4 font-bold">Ingresos por mes <span className="text-xs font-normal text-gray-500">(últimos 6 meses)</span></h2>
        <div className="flex h-52 items-end justify-between gap-3">
          {monthly.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400">{m.value > 0 ? formatMoney(m.value).replace('$', '$') : ''}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-blue-500 transition-all"
                  style={{ height: `${Math.max(2, (m.value / maxMonthly) * 100)}%` }}
                  title={formatMoney(m.value)}
                />
              </div>
              <span className="text-xs font-bold capitalize text-gray-500">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Top servicios */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
        <h2 className="mb-4 font-bold">Servicios que más venden <span className="text-xs font-normal text-gray-500">(en el período)</span></h2>
        {topServices.length === 0 ? (
          <p className="text-sm text-gray-500">No hay ventas completadas en este período.</p>
        ) : (
          <div className="space-y-3">
            {topServices.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate pr-3 text-gray-300">{s.name}</span>
                  <span className="shrink-0 font-bold">{formatMoney(s.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-950/60">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(s.value / maxService) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
