import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/api/client';
import { listOrgMembers, inviteMember, setMemberRole, removeMember as removeMemberApi, leaveOrg, deleteOwnOrganization } from '@/api';
import { useAuth } from '../context/AuthContext';
import { useOrgGuard } from '@/hooks/useOrgGuard';
import { formatDate } from '../lib/format';
import { roleLabel, roleChip, canManageTeam, type Role } from '../lib/roles';
import type { OrgMember } from '@/types';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { useConfirm } from '../components/ConfirmProvider';
import { Loader2, UserPlus, Copy, Check, Trash2, LogOut, Users2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Member = OrgMember;
type Invite = { id: string; code: string; email: string | null; role: Role; is_used: boolean; created_at: string };

export default function Equipo() {
  const { organizationId, organizationName, user, role, isSuperAdmin, refreshMemberships } = useAuth();
  const isFresh = useOrgGuard();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [counts, setCounts] = useState({ customers: 0, vehicles: 0, orders: 0 });
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('staff');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { document.title = 'Equipo — Mecanízame'; }, []);

  const isOwner = isSuperAdmin || role === 'owner';

  const load = useCallback(async () => {
    if (!organizationId) return;
    const oid = organizationId;
    setLoading(true);
    const [membersR, invitesR, custR, vehR, ordR] = await Promise.all([
      listOrgMembers(organizationId),
      supabase.from('org_invitations').select('id, code, email, role, is_used, created_at')
        .eq('organization_id', organizationId).eq('is_used', false).order('created_at', { ascending: false }),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null),
      supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    ]);
    if (!isFresh(oid)) return;
    setMembers((membersR.data ?? []) as Member[]);
    setInvites((invitesR.data ?? []) as Invite[]);
    setCounts({ customers: custR.count ?? 0, vehicles: vehR.count ?? 0, orders: ordR.count ?? 0 });
    setLoading(false);
  }, [organizationId, isFresh]);

  useEffect(() => { load(); }, [load]);

  const ownerCount = members.filter((m) => m.role === 'owner').length;

  const generate = async () => {
    setGenerating(true);
    const { data, error } = await inviteMember(organizationId!, newEmail.trim() || null, newRole);
    setGenerating(false);
    if (error || !data) return toast.error(error?.message || 'No se pudo generar la invitación');
    setNewEmail('');
    try { await navigator.clipboard.writeText(data as string); } catch { /* clipboard opcional */ }
    toast.success(`Invitación generada y copiada: ${data}`);
    load();
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 1500); } catch { /* noop */ }
  };

  const deleteInvite = async (inv: Invite) => {
    const { error } = await supabase.from('org_invitations').delete().eq('id', inv.id);
    if (error) return toast.error('No se pudo eliminar la invitación');
    toast.success('Invitación eliminada');
    load();
  };

  const changeRole = async (m: Member, nextRole: Role) => {
    if (nextRole === m.role) return;
    const { error } = await setMemberRole(organizationId!, m.user_id, nextRole);
    if (error) return toast.error(error.message || 'No se pudo cambiar el rol');
    toast.success('Rol actualizado');
    if (m.user_id === user?.id) await refreshMemberships();
    load();
  };

  const removeMember = async (m: Member) => {
    const ok = await confirm({
      title: `Quitar a ${m.full_name || m.email}`,
      message: 'Perderá el acceso a este taller. Sus registros creados se conservan.',
      confirmText: 'Quitar miembro',
    });
    if (!ok) return;
    const { error } = await removeMemberApi(organizationId!, m.user_id);
    if (error) return toast.error(error.message || 'No se pudo quitar al miembro');
    toast.success('Miembro quitado');
    load();
  };

  const leave = async () => {
    const ok = await confirm({
      title: 'Salir de este taller',
      message: 'Dejarás de tener acceso a este taller. Podrás volver si te invitan de nuevo.',
      confirmText: 'Salir del taller',
    });
    if (!ok) return;
    const { error } = await leaveOrg(organizationId!);
    if (error) return toast.error(error.message || 'No se pudo salir del taller');
    toast.success('Saliste del taller');
    await refreshMemberships();
  };

  const deleteOrg = async () => {
    const ok = await confirm({
      title: `Eliminar "${organizationName}"`,
      message: 'Se eliminará este taller de forma permanente. Como no tiene registros, es seguro, pero no se puede deshacer.',
      confirmText: 'Eliminar taller',
    });
    if (!ok) return;
    const { error } = await deleteOwnOrganization(organizationId!);
    if (error) return toast.error(error.message || 'No se pudo eliminar el taller');
    toast.success('Taller eliminado');
    await refreshMemberships();
    navigate('/', { replace: true });
  };

  if (!isSuperAdmin && !canManageTeam(role)) return <Navigate to="/" replace />;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;

  // Roles asignables por quien invita/gestiona: owner puede admin/staff; admin solo staff.
  const assignableInvite: Role[] = isOwner ? ['admin', 'staff'] : ['staff'];
  // El dueño puede eliminar su propio taller solo si está vacío (caso "creado por error").
  const orgEmpty = counts.customers + counts.vehicles + counts.orders === 0;
  const canDeleteOrg = !isSuperAdmin && role === 'owner';

  return (
    <div className="space-y-6">
      <PageHeader title="Equipo" subtitle="Los miembros de este taller y sus permisos. Invita con un código y asigna roles." help={HELP.equipo} />

      {/* Invitar */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex items-center gap-2 font-bold"><UserPlus className="h-4 w-4 text-blue-400" /> Invitar a un miembro</h2>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Genera un código y compártelo. Quien lo use se unirá a este taller con el rol que elijas. Los códigos son de un solo uso.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email"
            aria-label="Correo del invitado (opcional)"
            placeholder="Correo del invitado (opcional)" className="inp max-w-xs !py-2 text-sm" />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} aria-label="Rol"
            className="inp !w-auto !py-2 text-sm">
            {assignableInvite.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
          </select>
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invitar
          </button>
        </div>

        {invites.length > 0 && (
          <div className="mt-4 divide-y divide-white/5">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-3">
                  <code className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-blue-300">{inv.code}</code>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleChip[inv.role]}`}>{roleLabel[inv.role]}</span>
                  {inv.email && <span className="text-xs text-gray-400">{inv.email}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyCode(inv.code)} title="Copiar código"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-blue-300">
                    {copied === inv.code ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button onClick={() => deleteInvite(inv)} title="Eliminar invitación"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Miembros */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">Miembros ({members.length})</h2>
        {members.length === 0 ? (
          <EmptyState icon={Users2} title="Solo estás tú" description="Invita a tu equipo con un código para que trabajen contigo en este taller." />
        ) : members.map((m) => {
          const isMe = m.user_id === user?.id;
          const lastOwner = m.role === 'owner' && ownerCount <= 1;
          // Quién puede editar a este miembro: owner a cualquiera; admin solo a staff.
          const canEdit = (isOwner || m.role === 'staff') && !lastOwner;
          const roleOptions: Role[] = isOwner ? ['owner', 'admin', 'staff'] : ['admin', 'staff'];
          return (
            <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-gray-900/40 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-sm font-black uppercase text-blue-400">
                  {(m.full_name || m.email || '?').slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold">
                    {m.full_name || m.email}
                    {isMe && <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-400">Tú</span>}
                  </p>
                  <p className="text-[11px] text-gray-500">{m.email} · desde {formatDate(m.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <select value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)} aria-label={`Rol de ${m.email}`}
                    className="inp !w-auto !py-1.5 text-xs font-bold">
                    {roleOptions.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                ) : (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleChip[m.role]}`}>{roleLabel[m.role]}</span>
                )}
                {isMe ? (
                  !lastOwner && (
                    <button onClick={leave} title="Salir del taller"
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300 transition-colors hover:bg-red-500/10 hover:text-red-400">
                      <LogOut className="h-3.5 w-3.5" /> Salir
                    </button>
                  )
                ) : (
                  (isOwner || m.role === 'staff') && !lastOwner && (
                    <button onClick={() => removeMember(m)} title="Quitar del taller"
                      className="rounded-xl border border-white/10 px-2.5 py-1.5 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canDeleteOrg && (
        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <h2 className="flex items-center gap-2 font-bold text-red-300"><Trash2 className="h-4 w-4" /> Eliminar este taller</h2>
          {orgEmpty ? (
            <>
              <p className="mt-1 text-xs text-gray-400">Este taller no tiene registros. Si lo creaste por error, puedes eliminarlo tú mismo. Esta acción no se puede deshacer.</p>
              <button onClick={deleteOrg}
                className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-black text-red-300 transition-colors hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" /> Eliminar este taller
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs text-gray-400">
              Este taller ya tiene registros ({counts.customers} cliente(s), {counts.vehicles} vehículo(s), {counts.orders} orden(es)), así que no puede autoeliminarse. Para borrarlo, pídeselo al administrador.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
