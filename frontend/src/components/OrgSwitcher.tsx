import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { billingInfo, billingChip } from '../lib/billing';
import { roleLabel, roleChip } from '../lib/roles';
import WorkshopEntryModal from './WorkshopEntryModal';
import { Check, ChevronsUpDown, Plus, Store, Loader2 } from 'lucide-react';

/** Selector de taller activo. Lista los talleres del usuario (con rol y estado de cobro),
 *  permite cambiar entre ellos, crear uno nuevo o unirse con un código.
 *  No se muestra al super-admin (usa /admin) ni durante impersonación. */
export default function OrgSwitcher({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { memberships, organization, role, switchOrg, switching, isSuperAdmin, isImpersonating, user, refreshMemberships } = useAuth();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<'create' | 'join' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (isSuperAdmin || isImpersonating || memberships.length === 0) return null;

  const menuPos = variant === 'desktop' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-gray-900/40 px-3 py-2 text-left transition-colors hover:bg-white/5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/15 text-blue-400">
          <Store className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{organization?.name ?? 'Mi taller'}</p>
          <p className="truncate text-[11px] text-gray-500">{role ? roleLabel[role] : ''}{user?.email ? ` · ${user.email}` : ''}</p>
        </div>
        {switching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-500" /> : <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-500" />}
      </button>

      {open && (
        <div role="menu" className={`absolute left-0 right-0 z-40 ${menuPos} animate-scaleIn overflow-hidden rounded-xl border border-white/10 bg-gray-900`} style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="max-h-72 overflow-y-auto custom-scrollbar p-1">
            {memberships.map((m) => {
              const active = m.organization.id === organization?.id;
              const bi = billingInfo(m.organization.paid_until);
              const inactive = m.organization.is_active === false;
              const pending = m.organization.is_approved === false;
              const showBill = inactive || bi.status === 'por_vencer' || bi.status === 'vencido' || bi.status === 'suspendido';
              return (
                <button key={m.organization.id} role="menuitemradio" aria-checked={active}
                  onClick={() => { if (!active) switchOrg(m.organization.id); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${active ? 'bg-blue-500/10' : 'hover:bg-white/5'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{m.organization.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className={`rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase ${roleChip[m.role]}`}>{roleLabel[m.role]}</span>
                      {pending && <span className="rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase chip-pending">Pendiente</span>}
                      {showBill && <span className={`rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase ${inactive ? 'chip-cancel' : billingChip[bi.status]}`}>{inactive ? 'Inactivo' : bi.label}</span>}
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-blue-400" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-white/10 p-1">
            <button onClick={() => { setEntry('create'); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-bold text-gray-300 transition-colors hover:bg-white/5">
              <Plus className="h-4 w-4 text-gray-500" /> Crear taller
            </button>
            <button onClick={() => { setEntry('join'); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-bold text-gray-300 transition-colors hover:bg-white/5">
              <ChevronsUpDown className="h-4 w-4 text-gray-500" /> Unirme a otro taller
            </button>
          </div>
        </div>
      )}

      {entry && <WorkshopEntryModal initialMode={entry} onClose={() => setEntry(null)} onDone={refreshMemberships} />}
    </div>
  );
}
