import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/api/client';
import { listPendingOrgs, registerOrgPayment, setOrgBilling, setOrgActive, generatePlatformInvitation, approveOrg as approveOrgRpc } from '@/api';
import { useAuth } from '../context/AuthContext';
import type { Organization, PendingOrg } from '@/types';
import { formatMoney, formatDate, parseCLP, dateInputValue } from '../lib/format';
import { addMonthsClamped } from '../lib/date';
import { billingInfo, billingChip, BILLING } from '../lib/billing';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { useConfirm } from '../components/ConfirmProvider';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Loader2, Building2, Users, Car, ClipboardList, TrendingUp, KeyRound, Copy, Check, LogIn, Plus, Trash2, Power, Wallet, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';

type OrgRow = Organization & { created_at: string };
type Agg = { customers: number; vehicles: number; orders: number; revenue: number };
type Invite = { id: string; code: string; note: string | null; is_used: boolean; used_at: string | null; created_at: string };
type Pending = PendingOrg;

const ORG_FIELDS = 'id, name, slug, plan, logo_url, brand_color, business_hours, is_active, is_approved, created_at, paid_until, last_payment_at, monthly_fee';

export default function Admin() {
  const { isSuperAdmin, loading: authLoading, impersonate } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [agg, setAgg] = useState<Record<string, Agg>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [billingOrg, setBillingOrg] = useState<OrgRow | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);

  useEffect(() => { document.title = 'Administración — Mecanízame'; }, []);

  const loadInvites = async () => {
    const { data } = await supabase.from('invitations').select('*').order('created_at', { ascending: false });
    setInvites((data ?? []) as Invite[]);
  };

  const loadAll = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    const [orgsR, custR, vehR, ordR, pendingR] = await Promise.all([
      supabase.from('organizations').select(ORG_FIELDS).order('created_at'),
      supabase.from('customers').select('organization_id').is('deleted_at', null),
      supabase.from('vehicles').select('organization_id').is('deleted_at', null),
      supabase.from('work_orders').select('organization_id, status, total_amount'),
      listPendingOrgs(),
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
    setOrgs((orgsR.data ?? []) as OrgRow[]);
    setAgg(a);
    setPending((pendingR.data ?? []) as Pending[]);
    await loadInvites();
    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totals = useMemo(() => {
    const t = { orgs: orgs.filter((o) => o.is_approved).length, customers: 0, orders: 0, revenue: 0 };
    for (const id in agg) { t.customers += agg[id].customers; t.orders += agg[id].orders; t.revenue += agg[id].revenue; }
    return t;
  }, [orgs, agg]);

  // Resumen de cobros: cuántos por vencer, cuántos vencidos/suspendidos y el total mensual configurado.
  const billing = useMemo(() => {
    const now = new Date();
    let porVencer = 0, vencidos = 0, mensual = 0;
    for (const o of orgs) {
      const s = billingInfo(o.paid_until, now).status;
      if (s === 'por_vencer') porVencer++;
      else if (s === 'vencido' || s === 'suspendido') vencidos++;
      if (o.monthly_fee && o.is_active) mensual += o.monthly_fee;
    }
    return { porVencer, vencidos, mensual };
  }, [orgs]);

  const registerPayment = async (o: OrgRow) => {
    const paidFuture = o.paid_until && new Date(o.paid_until + 'T12:00:00') > new Date();
    const base = paidFuture ? new Date(o.paid_until + 'T12:00:00') : new Date();
    // Clampeo de mes igual que el RPC (interval '1 month'): 31-ene → 28-feb, no 3-mar.
    const next = addMonthsClamped(base, 1);
    const nextLabel = next.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const ok = await confirm({
      title: `Registrar pago de ${o.name}`,
      message: `El servicio quedará pagado hasta el ${nextLabel}. Si estaba suspendido, se reactiva el acceso.`,
      confirmText: 'Registrar pago',
    });
    if (!ok) return;
    const { data, error } = await registerOrgPayment(o.id);
    if (error || !data) return toast.error('No se pudo registrar el pago');
    setOrgs((prev) => prev.map((x) => (x.id === o.id ? { ...x, paid_until: data as string, last_payment_at: new Date().toISOString() } : x)));
    toast.success('Pago registrado');
  };

  const saveBilling = async (o: OrgRow, paidUntil: string, monthlyFee: number | null) => {
    const { error } = await setOrgBilling(o.id, paidUntil || null, monthlyFee);
    if (error) return toast.error('No se pudo guardar el cobro');
    setOrgs((prev) => prev.map((x) => (x.id === o.id ? { ...x, paid_until: paidUntil || null, monthly_fee: monthlyFee } : x)));
    setBillingOrg(null);
    toast.success('Cobro actualizado');
  };

  const generate = async () => {
    setGenerating(true);
    const { data, error } = await generatePlatformInvitation(note.trim() || null);
    setGenerating(false);
    if (error || !data) { toast.error('No se pudo generar el código'); return; }
    setNote('');
    try { await navigator.clipboard.writeText(data); } catch { /* clipboard opcional */ }
    toast.success(`Código generado y copiado: ${data}`);
    loadInvites();
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 1500); } catch { /* noop */ }
  };

  const deleteInvite = async (inv: Invite) => {
    const ok = await confirm({ title: `Eliminar código ${inv.code}`, message: inv.is_used ? 'Ya fue usado; solo se quita del listado.' : 'Se eliminará este código de invitación.', confirmText: 'Eliminar código' });
    if (!ok) return;
    const { error } = await supabase.from('invitations').delete().eq('id', inv.id);
    if (error) { toast.error('No se pudo eliminar'); return; }
    toast.success('Clave eliminada');
    loadInvites();
  };

  const enterWorkshop = (o: OrgRow) => { impersonate(o); navigate('/'); };

  const toggleActive = async (o: OrgRow) => {
    const next = !o.is_active;
    const { error } = await setOrgActive(o.id, next);
    if (error) return toast.error('No se pudo actualizar');
    setOrgs((prev) => prev.map((x) => (x.id === o.id ? { ...x, is_active: next } : x)));
    toast.success(next ? 'Taller habilitado' : 'Taller deshabilitado — se cerró su sesión');
  };

  const deleteOrg = async (o: OrgRow) => {
    const ok = await confirm({
      title: `Eliminar "${o.name}"`,
      message: 'Se eliminarán TODOS sus datos (clientes, vehículos, órdenes, servicios). Esta acción no se puede deshacer.',
      confirmText: 'Eliminar taller',
    });
    if (!ok) return;
    const { error } = await supabase.from('organizations').delete().eq('id', o.id);
    if (error) return toast.error('No se pudo eliminar');
    setOrgs((prev) => prev.filter((x) => x.id !== o.id));
    toast.success('Taller eliminado');
  };

  const approveOrg = async (p: Pending) => {
    const { error } = await approveOrgRpc(p.org_id);
    if (error) return toast.error('No se pudo aprobar el taller');
    toast.success('Taller aprobado');
    loadAll();
  };

  const rejectOrg = async (p: Pending) => {
    const ok = await confirm({
      title: `Rechazar "${p.name}"`,
      message: 'Se eliminará este taller pendiente. No se puede deshacer.',
      confirmText: 'Rechazar taller',
    });
    if (!ok) return;
    const { error } = await supabase.from('organizations').delete().eq('id', p.org_id);
    if (error) return toast.error('No se pudo rechazar el taller');
    toast.success('Taller rechazado');
    loadAll();
  };

  if (authLoading || loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const pendingInvites = invites.filter((i) => !i.is_used).length;
  const approvedOrgs = orgs.filter((o) => o.is_approved);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración"
        subtitle="Vista de Super Admin: todos los talleres de la plataforma, métricas e invitaciones."
        help={HELP.admin}
      />

      {/* Talleres por aprobar */}
      {pending.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold"><Building2 className="h-4 w-4 text-amber-400" /> Talleres por aprobar</h2>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold chip-pending">{pending.length}</span>
          </div>
          <p className="mb-3 text-xs text-gray-400">
            Talleres que un dueño creó y esperan tu aprobación para poder usarse. Si el dueño ya tiene un taller deshabilitado, podría estar intentando sortear la suspensión.
          </p>
          <div className="divide-y divide-white/5">
            {pending.map((p) => (
              <div key={p.org_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {p.name}
                    {p.creator_has_blocked_org && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold chip-danger">⚠ Dueño con taller deshabilitado</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500">{p.owner_email ?? 'sin dueño'} · creado {formatDate(p.created_at)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => approveOrg(p)} title="Aprobar taller"
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-300 transition-colors hover:bg-emerald-500/20">
                    <Check className="h-4 w-4" /> Aprobar
                  </button>
                  <button onClick={() => rejectOrg(p)} title="Rechazar (eliminar) taller"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300 transition-colors hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="h-4 w-4" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Totales de plataforma */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Building2} label="Talleres" value={String(totals.orgs)} accent />
        <Kpi icon={Users} label="Clientes (total)" value={String(totals.customers)} />
        <Kpi icon={ClipboardList} label="Órdenes (total)" value={String(totals.orders)} />
        <Kpi icon={TrendingUp} label="Ingresos (total)" value={formatMoney(totals.revenue)} />
      </div>

      {/* Invitaciones */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4 text-blue-400" /> Códigos de invitación</h2>
          <span className="text-xs text-gray-500">{pendingInvites} pendiente(s) · {invites.length} total</span>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Genera un código y entrégalo a un taller para que pueda registrarse. Cada código es de un solo uso.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)}
            aria-label="Referencia de la invitación (opcional)"
            placeholder="Referencia (opcional): p. ej. Taller de Pedro"
            className="inp max-w-xs !py-2 text-sm" />
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Generar código
          </button>
        </div>

        {invites.length === 0 && (
          <p className="mt-4 text-xs text-gray-500">Aún no has generado códigos. Genera el primero con el botón de arriba.</p>
        )}
        {invites.length > 0 && (
          <div className="mt-4 divide-y divide-white/5">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-3">
                  <code className={`rounded-lg border px-2.5 py-1 font-mono text-sm font-bold tracking-widest ${inv.is_used ? 'border-white/10 text-gray-500 line-through' : 'border-blue-500/30 bg-blue-500/10 text-blue-300'}`}>
                    {inv.code}
                  </code>
                  {inv.note && <span className="text-xs text-gray-400">{inv.note}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${inv.is_used ? 'chip-cancel' : 'chip-pending'}`}>
                    {inv.is_used ? `Usada ${inv.used_at ? formatDate(inv.used_at) : ''}` : 'Pendiente'}
                  </span>
                  {!inv.is_used && (
                    <button onClick={() => copyCode(inv.code)} title="Copiar"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-blue-300">
                      {copied === inv.code ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                  <button onClick={() => deleteInvite(inv)} title="Eliminar código"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Talleres y cobros */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">Talleres y cobros</h2>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            {billing.vencidos > 0 && <span className="rounded-full border px-2 py-0.5 chip-danger">{billing.vencidos} vencido(s)</span>}
            {billing.porVencer > 0 && <span className="rounded-full border px-2 py-0.5 chip-pending">{billing.porVencer} por vencer</span>}
            <span className="text-gray-500">Mensual configurado: <span className="text-gray-300">{formatMoney(billing.mensual)}</span></span>
          </div>
        </div>
        {approvedOrgs.length === 0 && (
          <EmptyState icon={Building2} title="Aún no hay talleres registrados"
            description="Genera un código de invitación y entrégalo a un taller para que se registre." />
        )}
        {approvedOrgs.map((o) => {
          const m = agg[o.id] ?? { customers: 0, vehicles: 0, orders: 0, revenue: 0 };
          const bi = billingInfo(o.paid_until);
          return (
            <div key={o.id} className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black">{o.name}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${o.is_active ? 'chip-done' : 'chip-cancel'}`}>
                        {o.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">Plan {o.plan ?? 'free'} · desde {formatDate(o.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-black text-blue-300">{formatMoney(m.revenue)}</p>
                    <p className="text-[11px] text-gray-500">ingresos completados</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => enterWorkshop(o)} title="Entrar al taller"
                      className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-300 transition-colors hover:bg-blue-500/20">
                      <LogIn className="h-4 w-4" /> Entrar
                    </button>
                    <button onClick={() => toggleActive(o)} title={o.is_active ? 'Deshabilitar taller' : 'Habilitar taller'}
                      className={`rounded-xl border px-2.5 py-2 transition-colors ${o.is_active ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'}`}>
                      <Power className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteOrg(o)} title="Eliminar taller"
                      className="rounded-xl border border-white/10 px-2.5 py-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Metric icon={Users} label="Clientes" value={m.customers} />
                <Metric icon={Car} label="Vehículos" value={m.vehicles} />
                <Metric icon={ClipboardList} label="Órdenes" value={m.orders} />
              </div>

              {/* Estado de cobro */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-gray-950/40 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${billingChip[bi.status]}`}>{bi.label}</span>
                  {o.monthly_fee ? <span className="font-bold text-gray-300">{formatMoney(o.monthly_fee)}/mes</span> : <span className="text-gray-500">sin monto definido</span>}
                  {bi.dueLabel && <span className="text-gray-500">· vence {bi.dueLabel}</span>}
                  {o.last_payment_at && <span className="text-gray-500">· últ. pago {formatDate(o.last_payment_at)}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => registerPayment(o)} title="Registrar pago (suma un mes al vencimiento)"
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-300 transition-colors hover:bg-emerald-500/20">
                    <Wallet className="h-3.5 w-3.5" /> Registrar pago
                  </button>
                  <button onClick={() => setBillingOrg(o)} title="Configurar monto y vencimiento"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300 transition-colors hover:bg-white/5">
                    <Pencil className="h-3.5 w-3.5" /> Configurar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {billingOrg && (
        <BillingModal org={billingOrg} revenue={agg[billingOrg.id]?.revenue ?? 0}
          onClose={() => setBillingOrg(null)} onSave={(pu, fee) => saveBilling(billingOrg, pu, fee)} />
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/10 bg-gray-900/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="card-label">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${accent ? 'text-blue-400' : 'text-gray-600'}`} />
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-gray-950/40 px-3 py-2.5">
      <Icon className="h-4 w-4 text-gray-500" />
      <div>
        <p className="text-sm font-black leading-none">{value}</p>
        <p className="card-label mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function BillingModal({ org, revenue, onClose, onSave }: {
  org: OrgRow; revenue: number; onClose: () => void; onSave: (paidUntil: string, monthlyFee: number | null) => void;
}) {
  useBodyScrollLock();
  const dialogRef = useModalA11y(onClose);
  const [fee, setFee] = useState(org.monthly_fee ? String(org.monthly_fee) : '');
  const [due, setDue] = useState(() => {
    if (org.paid_until) return org.paid_until;
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return dateInputValue(d.toISOString());
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!due) return toast.error('Indica la fecha de vencimiento');
    setSaving(true);
    await onSave(due, fee.trim() ? parseCLP(fee) : null);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}
        className="animate-scaleIn max-h-[90vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-gray-900 p-6 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">Configurar cobro · {org.name}</h3>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className="rounded-lg p-1 text-gray-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-gray-950/40 p-3 text-xs text-gray-400">
            Facturación registrada del taller: <span className="font-black text-gray-200">{formatMoney(revenue)}</span>.
            Úsala de referencia para fijar una mensualidad proporcional a lo que gana.
          </div>
          <div className="space-y-1.5">
            <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Monto mensual (CLP)</label>
            <input value={fee} inputMode="numeric" onChange={(e) => setFee(e.target.value)} placeholder="Ej: 25000 — vacío si aún no lo defines" className="inp" />
          </div>
          <div className="space-y-1.5">
            <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Próximo vencimiento</label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="inp" />
            <p className="ml-1 text-[11px] text-gray-500">El taller ve el aviso {BILLING.warnDays} días antes; tras {BILLING.graceDays} días de gracia sin pago, su acceso se suspende solo.</p>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
