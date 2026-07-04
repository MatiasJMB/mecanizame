import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/api/client';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrgGuard } from '@/hooks/useOrgGuard';
import { canSeeFinanzas } from '../lib/roles';
import { formatMoney, formatCompactCLP, formatDate } from '../lib/format';
import { dayKey, monthKey, addDays, itemNames } from '../lib/date';
import { ACTIVE_STATUSES, type WorkOrderStatus } from '../lib/taller';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import SegmentedToggle from '../components/SegmentedToggle';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import toast from 'react-hot-toast';
import {
  Loader2, TrendingUp, TrendingDown, Wallet, CalendarRange, X,
  Download, ChartLine, Table2, Check, ChevronDown,
} from 'lucide-react';

type FinOrder = {
  code: string | null;
  status: WorkOrderStatus;
  total_amount: number;
  created_at: string;
  customers: { full_name: string } | null;
  vehicles: { license_plate: string } | null;
  work_order_items: { subtotal: number; description: string | null; services: { name: string } | null }[];
};
type Preset = 'month' | 'lastMonth' | 'q' | 'year' | 'custom';
type Bucket = { key: string; label: string; full: string; value: number; count: number };
type Period = { preset: Preset; from: string; to: string };

const monthLabel = (d: Date) => d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');

const PRESETS: [Preset, string][] = [
  ['month', 'Este mes'], ['lastMonth', 'Mes pasado'], ['q', 'Últimos 3 meses'], ['year', 'Este año'], ['custom', 'Personalizado'],
];

function rangeFor(preset: Preset, from: string, to: string): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (preset === 'month') return [start, now];
  if (preset === 'lastMonth') return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)];
  if (preset === 'q') return [new Date(now.getFullYear(), now.getMonth() - 2, 1), now];
  if (preset === 'year') return [new Date(now.getFullYear(), 0, 1), now];
  return [from ? new Date(from + 'T00:00:00') : start, to ? new Date(to + 'T23:59:59') : now];
}

/** Techo "bonito" para el eje Y: 1 / 2 / 2.5 / 5 × 10^n. */
function niceCeil(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  const f = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return f * p;
}

export default function Finanzas() {
  const { organizationId, isSuperAdmin, role } = useAuth();
  const isFresh = useOrgGuard();
  const [orders, setOrders] = useState<FinOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>('q');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [chartView, setChartView] = useState<'chart' | 'table'>('chart');
  const [bucket, setBucket] = useState<Bucket | null>(null);

  useEffect(() => { document.title = 'Finanzas — Mecanízame'; }, []);

  useEffect(() => {
    if (!organizationId) return;
    const oid = organizationId;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('work_orders')
        .select('code, status, total_amount, created_at, customers(full_name), vehicles(license_plate), work_order_items(subtotal, description, services(name))')
        .eq('organization_id', organizationId).order('created_at');
      if (!isFresh(oid)) return;
      setOrders((data ?? []) as unknown as FinOrder[]);
      setLoading(false);
    })();
  }, [organizationId, isFresh]);

  // Solo las órdenes Terminadas cuentan como venta; las activas son "por cobrar".
  const completed = useMemo(() => orders.filter((o) => o.status === 'completed'), [orders]);
  const activeNow = useMemo(() => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)), [orders]);
  const activeValue = activeNow.reduce((a, o) => a + (o.total_amount ?? 0), 0);

  const [start, end] = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);
  const inRange = useMemo(() => completed.filter((o) => { const d = new Date(o.created_at); return d >= start && d <= end; }), [completed, start, end]);

  const revenue = inRange.reduce((a, o) => a + (o.total_amount ?? 0), 0);
  const count = inRange.length;
  const avg = count ? Math.round(revenue / count) : 0;

  const deltas = useMemo(() => {
    const len = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - len);
    const prev = completed.filter((o) => { const d = new Date(o.created_at); return d >= prevStart && d <= prevEnd; });
    const pRev = prev.reduce((a, o) => a + (o.total_amount ?? 0), 0);
    const pCount = prev.length;
    const pAvg = pCount ? pRev / pCount : 0;
    const pct = (cur: number, base: number) => (base ? (cur - base) / base : null);
    return { revenue: pct(revenue, pRev), count: pct(count, pCount), avg: pct(avg, pAvg) };
  }, [completed, start, end, revenue, count, avg]);

  // Puntos según el rango elegido: por día si abarca ≤ ~1.5 meses, por mes si es más largo.
  const chart = useMemo(() => {
    const spanDays = (end.getTime() - start.getTime()) / 86400000;
    const daily = spanDays <= 46;
    const map = new Map<string, Bucket>();
    if (daily) {
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d = addDays(d, 1)) {
        map.set(dayKey(d), {
          key: dayKey(d), label: String(d.getDate()),
          full: d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' }),
          value: 0, count: 0,
        });
      }
    } else {
      let d = new Date(start.getFullYear(), start.getMonth(), 1);
      const endM = new Date(end.getFullYear(), end.getMonth(), 1);
      while (d <= endM) {
        map.set(monthKey(d), {
          key: monthKey(d), label: monthLabel(d),
          full: d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }),
          value: 0, count: 0,
        });
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
    }
    for (const o of inRange) {
      const d = new Date(o.created_at);
      const b = map.get(daily ? dayKey(d) : monthKey(d));
      if (b) { b.value += o.total_amount ?? 0; b.count += 1; }
    }
    const now = new Date();
    const curKey = daily ? dayKey(now) : monthKey(now);
    return { daily, curKey, buckets: [...map.values()] };
  }, [inRange, start, end]);

  const yMax = niceCeil(Math.max(1, ...chart.buckets.map((b) => b.value)));
  const avgBucket = chart.buckets.length ? Math.round(chart.buckets.reduce((a, b) => a + b.value, 0) / chart.buckets.length) : 0;
  const labelStep = Math.max(1, Math.ceil(chart.buckets.length / 8));
  const nBars = chart.buckets.length;

  const bucketOrders = useMemo(() => {
    if (!bucket) return [];
    const daily = chart.daily;
    return inRange.filter((o) => (daily ? dayKey(new Date(o.created_at)) : monthKey(new Date(o.created_at))) === bucket.key);
  }, [bucket, inRange, chart.daily]);

  // Exporta las ventas del período como CSV para Excel (BOM + ";" por locale es-CL).
  const exportCsv = () => {
    const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const head = ['Fecha', 'Código', 'Cliente', 'Patente', 'Servicios', 'Monto CLP'];
    const rows = inRange.map((o) => [
      dayKey(new Date(o.created_at)),
      o.code ?? '',
      o.customers?.full_name ?? 'Sin cliente',
      o.vehicles?.license_plate ?? '',
      itemNames(o.work_order_items).join(' + '),
      String(o.total_amount ?? 0),
    ]);
    const bom = String.fromCharCode(0xfeff); // BOM para que Excel abra el CSV como UTF-8
    const csv = bom + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${dayKey(start)}_a_${dayKey(end)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} venta(s) exportadas`);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  // Finanzas es solo para dueño/admin (y super-admin). El staff no la ve.
  if (!isSuperAdmin && !canSeeFinanzas(role)) return <Navigate to="/" replace />;

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Finanzas" subtitle="Ingresos y ventas del taller. Solo cuentan las órdenes terminadas." help={HELP.finanzas} />
        <EmptyState icon={Wallet} title="Aún no hay ventas registradas"
          description={isSuperAdmin
            ? 'Estás en tu cuenta de administrador. Entra a un taller desde “Talleres” para ver sus finanzas.'
            : 'Cuando marques órdenes como “Terminadas”, verás aquí tus ingresos, ticket promedio y estadísticas de ventas.'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Finanzas" subtitle="Ingresos y ventas del taller. Solo cuentan las órdenes terminadas." help={HELP.finanzas}>
        <PeriodPicker preset={preset} from={from} to={to}
          onChange={(p: Period) => { setPreset(p.preset); setFrom(p.from); setTo(p.to); }} />
        <button onClick={exportCsv} disabled={inRange.length === 0} title="Descarga las ventas del período para Excel"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 disabled:opacity-40">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </PageHeader>

      {/* Bloque estático: en desktop todo cabe en el viewport, sin scroll de página */}
      <div className="flex flex-col gap-4 lg:h-[calc(100vh-12rem)]">
        <div className="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Ingresos del período" value={formatMoney(revenue)} delta={deltas.revenue} accent big />
          <Kpi label="Trabajos terminados" value={String(count)} delta={deltas.count} />
          <Kpi label="Ticket promedio" value={formatMoney(avg)} delta={deltas.avg} />
          <Kpi label="En el taller ahora" value={formatMoney(activeValue)}
            hint={`${activeNow.length} trabajo(s) activo(s) por cobrar — no depende del período`} />
        </div>

        {/* Gráfico dominante: absorbe la altura restante */}
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-gray-900/40 p-5 max-lg:h-[24rem]">
          <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
            <h2 className="font-bold">Ingresos {chart.daily ? 'por día' : 'por mes'}</h2>
            <SegmentedToggle value={chartView} onChange={setChartView}
              options={[
                { v: 'chart', label: 'Gráfico', icon: <ChartLine className="h-3.5 w-3.5" /> },
                { v: 'table', label: 'Tabla', icon: <Table2 className="h-3.5 w-3.5" /> },
              ]} />
          </div>

          {inRange.length === 0 ? (
            <div className="grid min-h-0 flex-1 place-items-center">
              <EmptyState compact icon={CalendarRange} title="Sin trabajos terminados entre estas fechas"
                description="Prueba con otro período. Tus ventas históricas siguen guardadas."
                secondary={{ label: 'Ver este año', onClick: () => setPreset('year') }} />
            </div>
          ) : chartView === 'table' ? (
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="card-label py-2 pr-2">Período</th>
                    <th className="card-label py-2 pr-2 text-right">Trabajos</th>
                    <th className="card-label py-2 text-right">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.buckets.map((b) => (
                    <tr key={b.key} onClick={() => b.count > 0 && setBucket(b)}
                      className={`border-b border-white/5 capitalize ${b.count > 0 ? 'cursor-pointer hover:bg-white/5' : 'text-gray-600'}`}>
                      <td className="py-2 pr-2">{b.full}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{b.count || '—'}</td>
                      <td className="py-2 text-right font-bold tabular-nums">{b.value ? formatMoney(b.value) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1">
                {/* Eje Y con números redondos */}
                <div className="flex w-14 shrink-0 flex-col justify-between pr-2 text-right text-[10px] tabular-nums leading-none text-gray-500">
                  {[1, 0.75, 0.5, 0.25, 0].map((t) => <span key={t}>{formatCompactCLP(yMax * t)}</span>)}
                </div>
                <RevenueLineChart buckets={chart.buckets} yMax={yMax} avgBucket={avgBucket}
                  curKey={chart.curKey} onSelect={setBucket} />
              </div>
              <div className={`mt-2 flex shrink-0 pl-14 ${nBars > 12 ? 'gap-[2px]' : 'gap-2 sm:gap-3'}`}>
                {chart.buckets.map((b, i) => (
                  <span key={b.key} className={`flex-1 overflow-hidden text-center text-[11px] font-bold capitalize ${b.key === chart.curKey ? 'text-blue-300' : 'text-gray-500'}`}>
                    {i % labelStep === 0 ? b.label : ''}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {bucket && <BucketDetail bucket={bucket} daily={chart.daily} orders={bucketOrders} onClose={() => setBucket(null)} />}
    </div>
  );
}

/* ---------- Selector de período (popover con presets como filas) ---------- */

function PeriodPicker({ preset, from, to, onChange }: {
  preset: Preset; from: string; to: string; onChange: (next: Period) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const label = preset === 'custom'
    ? (from && to ? `${formatDate(from + 'T12:00:00')} — ${formatDate(to + 'T12:00:00')}` : 'Personalizado')
    : PRESETS.find(([p]) => p === preset)?.[1] ?? '';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5">
        <CalendarRange className="h-3.5 w-3.5" /> {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" style={{ boxShadow: 'var(--shadow-lg)' }}
          className="animate-scaleIn absolute right-0 top-full z-40 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-gray-900 p-1.5">
          {PRESETS.filter(([p]) => p !== 'custom').map(([p, lbl]) => (
            <button key={p} role="menuitemradio" aria-checked={preset === p}
              onClick={() => { onChange({ preset: p, from: '', to: '' }); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/5 ${preset === p ? 'font-bold text-white' : 'text-gray-300'}`}>
              {lbl} {preset === p && <Check className="h-4 w-4 text-blue-400" />}
            </button>
          ))}
          <div className="mt-1.5 border-t border-white/10 px-3 pb-2.5 pt-2">
            <p className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Personalizado {preset === 'custom' && <Check className="h-4 w-4 text-blue-400" />}
            </p>
            <div className="space-y-1.5">
              <input type="date" value={from} aria-label="Desde"
                onChange={(e) => onChange({ preset: 'custom', from: e.target.value, to })} className="inp !py-1.5 text-sm" />
              <input type="date" value={to} aria-label="Hasta"
                onChange={(e) => onChange({ preset: 'custom', from, to: e.target.value })} className="inp !py-1.5 text-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Gráfico de línea con puntos y área (SVG propio) ---------- */

function RevenueLineChart({ buckets, yMax, avgBucket, curKey, onSelect }: {
  buckets: Bucket[]; yMax: number; avgBucket: number; curKey: string;
  onSelect: (b: Bucket) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const pointRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const n = buckets.length;
  const defaultIdx = Math.max(0, buckets.findIndex((b) => b.key === curKey));
  const xPct = (i: number) => ((i + 0.5) / n) * 100;   // centro de banda: alinea con la fila de labels
  const yPct = (v: number) => 100 - (v / yMax) * 100;
  const pts = buckets.map((b, i) => `${xPct(i)},${yPct(b.value)}`);
  const lineD = `M${pts.join(' L')}`;
  const areaD = `${lineD} L${xPct(n - 1)},100 L${xPct(0)},100 Z`;

  const focusIdx = (i: number) => pointRefs.current[i]?.focus();
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); focusIdx(Math.min(n - 1, i + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); focusIdx(Math.max(0, i - 1)); }
    if (e.key === 'Home') { e.preventDefault(); focusIdx(0); }
    if (e.key === 'End') { e.preventDefault(); focusIdx(n - 1); }
  };

  const hov = hovered !== null ? buckets[hovered] : null;

  return (
    <div className="relative flex-1"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const i = Math.floor(((e.clientX - r.left) / r.width) * n);
        setHovered(Math.max(0, Math.min(n - 1, i)));
      }}
      onPointerLeave={() => setHovered(null)}>

      {/* Gridlines (hairline, recesivas) */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <div key={t} className="absolute inset-x-0 h-px bg-white/5" style={{ bottom: `${t * 100}%` }} />
      ))}

      {/* Línea de promedio del período */}
      {avgBucket > 0 && (
        <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed"
          style={{ bottom: `${(avgBucket / yMax) * 100}%`, borderColor: 'var(--theme-muted)' }}>
          <span className="absolute -top-4 right-0 rounded bg-gray-900/80 px-1 text-[10px] text-gray-400">
            prom. {formatCompactCLP(avgBucket)}
          </span>
        </div>
      )}

      {/* Crosshair vertical que sigue el punto activo */}
      {hovered !== null && (
        <div className="pointer-events-none absolute inset-y-0 w-px"
          style={{ left: `${xPct(hovered)}%`, background: 'var(--theme-border-strong)' }} />
      )}

      {/* Área + línea (la geometría se estira al contenedor; el trazo queda en 2px) */}
      {n > 1 && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={areaD} fill="var(--theme-accent)" fillOpacity={0.1} stroke="none" />
          <path d={lineD} fill="none" stroke="var(--theme-accent)" strokeWidth={2}
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}

      {/* Puntos: botones accesibles (hit 24px, roving tabindex, flechas) */}
      {buckets.map((b, i) => {
        const cur = b.key === curKey;
        return (
          <button key={b.key} type="button"
            ref={(el) => { pointRefs.current[i] = el; }}
            tabIndex={i === (hovered ?? defaultIdx) ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => b.count > 0 && onSelect(b)}
            onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}
            aria-label={`${b.full}: ${formatMoney(b.value)} · ${b.count} trabajo(s)`}
            className={`absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${b.count > 0 ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ left: `${xPct(i)}%`, top: `${yPct(b.value)}%` }}>
            <span className={`rounded-full transition-transform ${cur ? 'h-2.5 w-2.5' : 'h-2 w-2'} ${hovered === i ? 'scale-125' : ''}`}
              style={{
                background: b.count > 0 ? 'var(--theme-accent)' : 'var(--theme-faint)',
                boxShadow: cur
                  ? '0 0 0 2px var(--theme-card), 0 0 0 5px var(--theme-accent-soft)'
                  : '0 0 0 2px var(--theme-card)',
              }} />
          </button>
        );
      })}

      {/* Tooltip: el valor manda, el label acompaña */}
      {hov && hovered !== null && (
        <div className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-lg border border-white/10 bg-gray-900 px-2.5 py-1.5 shadow-lg"
          style={{
            left: `clamp(3.5rem, ${xPct(hovered)}%, calc(100% - 3.5rem))`,
            bottom: `calc(${Math.min(80, 100 - yPct(hov.value))}% + 14px)`,
          }}>
          <p className="whitespace-nowrap text-sm font-black">{formatMoney(hov.value)}</p>
          <p className="whitespace-nowrap text-[11px] capitalize text-gray-400">{hov.full} · {hov.count} trabajo(s)</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Detalle de un día/mes ---------- */

function bucketTitle(b: Bucket, daily: boolean) {
  if (daily) return new Date(b.key + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' });
  const [y, m] = b.key.split('-').map(Number);
  return new Date(y, m, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
}

function BucketDetail({ bucket, daily, orders, onClose }: {
  bucket: Bucket; daily: boolean; orders: FinOrder[]; onClose: () => void;
}) {
  useBodyScrollLock();
  const total = orders.reduce((a, o) => a + (o.total_amount ?? 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="animate-scaleIn max-h-[85vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-black capitalize">{bucketTitle(bucket, daily)}</h3>
            <p className="text-xs text-gray-500">{orders.length} trabajo(s) terminado(s) · {formatMoney(total)}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className="rounded-lg p-1 text-gray-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Sin trabajos terminados en este período.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {orders.map((o, idx) => {
              const names = itemNames(o.work_order_items);
              return (
                <div key={idx} className="rounded-xl border border-white/10 bg-gray-950/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold">{o.customers?.full_name ?? 'Sin cliente'}</span>
                    {o.vehicles?.license_plate && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-gray-300">{o.vehicles.license_plate}</span>}
                    <span className="ml-auto shrink-0 text-sm font-black text-blue-300">{formatMoney(o.total_amount)}</span>
                  </div>
                  {names.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {names.map((n, i) => <span key={i} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-gray-400">{n}</span>)}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-gray-500">{o.code ?? '—'} · {formatDate(o.created_at)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Tarjeta KPI: label micro-uppercase, valor protagonista ---------- */

function Kpi({ label, value, delta, accent, big, hint }: {
  label: string; value: string; delta?: number | null; accent?: boolean; big?: boolean; hint?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/10 bg-gray-900/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="card-label">{label}</p>
        {delta != null && (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${up ? 'chip-done' : 'chip-cancel'}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? '+' : ''}{Math.round(delta * 100)}%
          </span>
        )}
      </div>
      <p className={`mt-2 font-black text-white ${big ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      {delta != null && <p className="mt-0.5 text-[11px] text-gray-500">vs período anterior</p>}
      {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}
