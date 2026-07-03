import { useState } from 'react';
import { validateOrgInvitation, createOrganization, acceptOrgInvitation } from '@/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import SegmentedToggle from './SegmentedToggle';
import PhoneInput from './PhoneInput';
import { roleLabel, type Role } from '../lib/roles';
import { X, Store, KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const formatCode = (v: string) => {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
};

/** Modal para crear un taller nuevo (autoservicio) o unirse a uno existente con un código.
 *  Reutilizado por el selector de taller y por la pantalla "sin taller". */
export default function WorkshopEntryModal({ onClose, onDone, initialMode = 'create' }: {
  onClose: () => void;
  onDone: () => Promise<void>; // refresca membresías; el taller queda activo server-side
  initialMode?: 'create' | 'join';
}) {
  useBodyScrollLock();
  const [mode, setMode] = useState<'create' | 'join'>(initialMode);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<{ org_name: string; role: Role } | null>(null);

  const checkCode = async (raw: string) => {
    setPreview(null);
    const clean = raw.trim();
    if (clean.replace('-', '').length < 8) return;
    const { data } = await validateOrgInvitation(clean);
    const row = data?.[0];
    if (row) setPreview({ org_name: row.org_name, role: row.role });
  };

  const createOrg = async () => {
    if (!name.trim()) return toast.error('Escribe el nombre del taller');
    setSaving(true);
    const { error } = await createOrganization(name.trim(), phone.trim() || null);
    setSaving(false);
    if (error) return toast.error(error.message || 'No se pudo crear el taller');
    toast.success('Taller creado. Queda pendiente de aprobación del administrador.');
    await onDone();
    onClose();
  };

  const joinOrg = async () => {
    if (!code.trim()) return toast.error('Ingresa el código de invitación');
    setSaving(true);
    const { error } = await acceptOrgInvitation(code.trim());
    setSaving(false);
    if (error) return toast.error(error.message || 'Código inválido o expirado');
    toast.success('Te uniste al taller');
    await onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="animate-scaleIn w-full max-w-md rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">Agregar taller</h3>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className="rounded-lg p-1 text-gray-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>

        <SegmentedToggle value={mode} onChange={setMode}
          options={[
            { v: 'create', label: 'Crear taller', icon: <Store className="h-3.5 w-3.5" /> },
            { v: 'join', label: 'Unirme con código', icon: <KeyRound className="h-3.5 w-3.5" /> },
          ]} />

        {mode === 'create' ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-org-name" className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Nombre del taller</label>
              <input id="new-org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Taller San Miguel" className="inp" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Teléfono (opcional)</label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
            <p className="text-[11px] text-gray-500">Quedará pendiente de aprobación del administrador antes de poder usarse. Si lo creas por error, lo puedes eliminar tú mismo desde Equipo mientras esté vacío.</p>
            <button onClick={createOrg} disabled={saving}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
              {saving ? 'Creando…' : 'Crear taller'}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="join-code" className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Código de invitación</label>
              <input id="join-code" value={code}
                onChange={(e) => { const c = formatCode(e.target.value); setCode(c); checkCode(c); }}
                placeholder="XXXX-XXXX" className="inp font-mono tracking-widest" autoFocus />
            </div>
            {preview && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
                Te unirás a <b>{preview.org_name}</b> como <b>{roleLabel[preview.role]}</b>.
              </div>
            )}
            <button onClick={joinOrg} disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {saving ? 'Uniéndote…' : 'Unirme al taller'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
