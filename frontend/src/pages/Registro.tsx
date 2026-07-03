import { useEffect, useState, useId } from 'react';
import { supabase } from '@/api/client';
import { validateOrgInvitation, validatePlatformInvitation, acceptOrgInvitation, redeemInvitation } from '@/api';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { translateError } from '../lib/auth-errors';
import { BRAND } from '../lib/taller';
import { roleLabel, type Role } from '../lib/roles';
import PhoneInput from '../components/PhoneInput';
import toast from 'react-hot-toast';

// Formatea la clave a XXXX-XXXX automáticamente (el taller no teclea el guion).
const formatCode = (v: string) => {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
};

export default function Registro() {
  useEffect(() => { document.title = 'Registrar taller — Mecanízame'; }, []);
  const { memberships } = useAuth();
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneValid, setPhoneValid] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teamPreview, setTeamPreview] = useState<{ org_name: string; role: Role } | null>(null);

  if (memberships.length) return <Navigate to="/" replace />;

  // Detecta si el código es una invitación de equipo (unirse a un taller existente)
  // o una clave de plataforma (crear un taller nuevo). El formulario se adapta.
  const onCode = async (raw: string) => {
    const c = formatCode(raw);
    setCode(c);
    setTeamPreview(null);
    if (c.replace('-', '').length === 8) {
      const { data } = await validateOrgInvitation(c);
      const row = data?.[0];
      if (row) setTeamPreview({ org_name: row.org_name, role: row.role });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    if (!teamPreview) {
      if (!orgName.trim()) return setError('Escribe el nombre del taller.');
      if (!phoneValid) return setError('Ingresa un teléfono válido de 9 dígitos.');
    }

    setLoading(true);

    // 1) Validar el código ANTES de crear la cuenta (el de equipo ya se validó al teclearlo).
    if (!teamPreview) {
      const { data: valid, error: vErr } = await validatePlatformInvitation(code.trim());
      if (vErr) { setError('No se pudo validar el código.'); setLoading(false); return; }
      if (!valid) { setError('El código es inválido, ya se usó o expiró. Pídeselo al administrador o a tu taller.'); setLoading(false); return; }
    }

    // 2) Crear la cuenta
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(translateError(error.message)); setLoading(false); return; }
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      setError('Este correo ya está registrado.'); setLoading(false); return;
    }
    if (!data.session) {
      setSuccess('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.');
      setLoading(false);
      return;
    }

    // 3) Crear el taller (código de plataforma) o unirse a uno existente (invitación de equipo).
    if (teamPreview) {
      const { error: aErr } = await acceptOrgInvitation(code.trim());
      if (aErr) { setError(aErr.message || 'No se pudo unir al taller.'); setLoading(false); return; }
    } else {
      const { error: rErr } = await redeemInvitation(code.trim(), orgName.trim(), phone.trim() || null);
      if (rErr) { setError(rErr.message || 'No se pudo crear el taller.'); setLoading(false); return; }
    }

    setSuccess(teamPreview ? '¡Te uniste al taller! Te llevamos al inicio de sesión…' : '¡Registro exitoso! Te llevamos al inicio de sesión…');
    toast.success(teamPreview ? 'Te uniste al taller' : 'Taller registrado con éxito');
    await supabase.auth.signOut();
    setTimeout(() => navigate('/login', { replace: true }), 2000);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950 p-4 text-gray-100">
      <div className="absolute left-[-12%] top-[-12%] h-[45%] w-[45%] rounded-full bg-blue-600/15 blur-[100px]" />
      <div className="absolute bottom-[-14%] right-[-10%] h-[45%] w-[45%] rounded-full bg-blue-900/40 blur-[110px]" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/60 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={isLight ? '/logo-mark-trans.png?v=2' : '/logo-mark-light.png?v=2'} alt={BRAND.name} className="mb-3 h-14 w-14 object-contain" />
          <h1 className="text-2xl font-black">{teamPreview ? 'Únete al taller' : 'Registra tu taller'}</h1>
          <p className="mt-1 text-sm text-gray-400">Con un código de administrador creas tu taller; con una invitación de equipo te unes a uno existente.</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reg-code" className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Código de registro o invitación</label>
            <input id="reg-code" value={code} onChange={(e) => onCode(e.target.value)} placeholder="XXXX-XXXX" required
              className="inp font-mono tracking-widest" />
          </div>

          {teamPreview ? (
            <div className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
              Te unirás a <b>{teamPreview.org_name}</b> como <b>{roleLabel[teamPreview.role]}</b>.
            </div>
          ) : (
            <>
              <Field label="Nombre del taller" value={orgName} onChange={setOrgName} placeholder="Ej: Taller San Miguel" />
              <div className="space-y-1.5">
                <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Teléfono</label>
                <PhoneInput value={phone} onChange={setPhone} onValidChange={setPhoneValid} required />
              </div>
            </>
          )}

          <Field label="Correo electrónico" value={email} onChange={setEmail} type="email" placeholder="taller@correo.cl" required />

          <PasswordField label="Contraseña (mínimo 6 caracteres)" value={password} onChange={setPassword} show={showPass} onToggle={() => setShowPass((s) => !s)} minLength={6} />
          <PasswordField label="Repetir contraseña" value={confirm} onChange={setConfirm} show={showConfirm} onToggle={() => setShowConfirm((s) => !s)} />

          <button type="submit" disabled={loading}
            className="mt-2 w-full rounded-xl bg-blue-600 py-3.5 font-black text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
            {loading ? (teamPreview ? 'Uniéndote…' : 'Registrando…') : (teamPreview ? 'Unirme al taller' : 'Registrar taller')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-bold text-blue-400 hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="inp" />
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, minLength }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; minLength?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} required minLength={minLength}
          placeholder="••••••••"
          className="inp" style={{ paddingRight: '2.75rem' }} />
        <button type="button" onClick={onToggle} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:text-white">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
