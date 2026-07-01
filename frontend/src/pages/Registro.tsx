import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { translateError } from '../lib/auth-errors';

export default function Registro() {
  const { session } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (session) return <Navigate to="/" replace />;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { organization_name: orgName, full_name: fullName } },
    });

    if (error) {
      setError(translateError(error.message));
      setLoading(false);
      return;
    }

    // Correo ya registrado (Supabase devuelve user sin identidades).
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      setError('Este correo ya está registrado.');
      setLoading(false);
      return;
    }

    if (!data.session) {
      setSuccess('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.');
      setLoading(false);
      return;
    }
    // Con sesión inmediata, onAuthStateChange carga la organización y redirige.
    setSuccess('Taller creado. Preparando tu panel…');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-gray-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/60 p-8 backdrop-blur-2xl">
        <h1 className="text-2xl font-black">
          Crea tu <span className="text-orange-400">taller</span>
        </h1>
        <p className="mt-1 mb-6 text-sm text-gray-400">Registra tu servicio técnico en segundos.</p>

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
          <Field label="Nombre del taller" value={orgName} onChange={setOrgName} placeholder="Ej: Diésel Pro Valparaíso" required />
          <Field label="Tu nombre" value={fullName} onChange={setFullName} placeholder="Ej: Juan Pérez" />
          <Field label="Correo electrónico" value={email} onChange={setEmail} type="email" required />
          <Field label="Contraseña (+6)" value={password} onChange={setPassword} type="password" minLength={6} required />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-orange-600 py-3.5 font-black transition-transform hover:bg-orange-500 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-bold text-orange-400 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full rounded-xl border border-white/10 bg-gray-950/50 px-4 py-3 text-white transition-colors placeholder:text-gray-600 focus:border-orange-500/60 focus:outline-none"
      />
    </div>
  );
}
