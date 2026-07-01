import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { translateError } from '../lib/auth-errors';
import { BRAND } from '../lib/taller';

export default function Login() {
  useEffect(() => { document.title = 'Taller Mecánico — Iniciar sesión'; }, []);
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (session) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(translateError(error.message));
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950 p-4 text-gray-100">
      {/* halos decorativos navy/cobalto */}
      <div className="absolute left-[-12%] top-[-12%] h-[45%] w-[45%] rounded-full bg-blue-600/15 blur-[100px]" />
      <div className="absolute bottom-[-14%] right-[-10%] h-[45%] w-[45%] rounded-full bg-blue-900/40 blur-[110px]" />

      <div className="relative z-10 mx-4 flex w-full max-w-[440px] flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-gray-900/60 shadow-2xl backdrop-blur-2xl lg:max-w-4xl lg:flex-row">
        {/* Panel de marca */}
        <div className="flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-blue-900/40 to-transparent p-8 text-center lg:w-1/2 lg:p-12">
          <div className="logo-tile w-44 p-4 md:w-52">
            <img src="/logo.png?v=1" alt={BRAND.name} className="w-full" />
          </div>
          <div>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-gray-300">{BRAND.tagline}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold text-blue-300">
              <ShieldCheck className="h-3.5 w-3.5" /> {BRAND.warranty}
            </div>
          </div>
        </div>

        {/* Panel de formulario */}
        <div className="p-8 lg:w-1/2 lg:p-12">
          <h1 className="text-2xl font-black">Iniciar sesión</h1>
          <p className="mt-1 mb-6 text-sm text-gray-400">Accede al panel de tu taller.</p>

          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm font-bold text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Correo electrónico</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" inputMode="email" required
                className="w-full rounded-xl border border-white/10 bg-gray-950/50 px-4 py-3.5 text-white transition-all placeholder:text-gray-600 focus:border-blue-500/60 focus:bg-gray-950 focus:outline-none"
                placeholder="tucorreo@taller.cl"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Contraseña</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" required
                className="w-full rounded-xl border border-white/10 bg-gray-950/50 px-4 py-3.5 text-white transition-all placeholder:text-gray-600 focus:border-blue-500/60 focus:bg-gray-950 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="group relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 font-black text-white shadow-lg shadow-blue-900/30 transition-all hover:shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              <span className="relative z-10">{loading ? 'Ingresando…' : 'Entrar al taller'}</span>
              <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0" />
            </button>
          </form>

          <p className="mt-8 text-center text-xs font-medium text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="ml-1 font-bold text-blue-400 hover:text-blue-300 hover:underline">
              Registra tu taller
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
