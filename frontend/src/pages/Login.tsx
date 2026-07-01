import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Cog } from 'lucide-react';
import { translateError } from '../lib/auth-errors';
import { BRAND } from '../lib/taller';

export default function Login() {
  useEffect(() => { document.title = 'Taller SaaS — Iniciar sesión'; }, []);
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
      {/* halos decorativos */}
      <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-orange-600/10 blur-[90px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-orange-600/10 blur-[90px]" />

      <div className="relative z-10 mx-4 flex w-full max-w-[440px] flex-col rounded-[2.5rem] border border-white/10 bg-gray-900/60 p-7 shadow-2xl backdrop-blur-2xl md:p-12 lg:max-w-5xl lg:flex-row lg:items-center lg:gap-16">
        <div className="lg:w-1/2">
          <div className="mb-8 text-center lg:mb-0">
            <div className="relative mb-4 inline-block">
              <div className="absolute inset-0 scale-150 animate-pulse rounded-full bg-orange-600/15 blur-2xl" />
              <div className="relative z-10 grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl shadow-orange-900/30 md:h-28 md:w-28">
                <Cog className="h-12 w-12 text-white md:h-14 md:w-14" />
              </div>
            </div>
            <h2 className="relative z-20 mb-3 text-3xl font-black leading-[0.95] tracking-tighter md:text-4xl">
              <span className="gradient-brand-text">Taller</span>
              <br />
              <span className="text-white drop-shadow-md">Diésel</span>
            </h2>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-gray-400">{BRAND.tagline}</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.35em] text-orange-400/70">
              {BRAND.warranty}
            </p>
          </div>
        </div>

        <div className="lg:w-1/2">
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Correo electrónico</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" inputMode="email" required
                className="w-full rounded-2xl border border-white/10 bg-gray-950/50 px-5 py-3.5 text-white transition-all placeholder:text-gray-600 focus:border-orange-500/50 focus:bg-gray-950 focus:outline-none"
                placeholder="tucorreo@taller.cl"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Contraseña</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" required
                className="w-full rounded-2xl border border-white/10 bg-gray-950/50 px-5 py-3.5 text-white transition-all placeholder:text-gray-600 focus:border-orange-500/50 focus:bg-gray-950 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="group relative mt-2 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 py-4 font-black text-white shadow-xl shadow-orange-900/20 transition-all hover:shadow-orange-600/30 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              <span className="relative z-10">{loading ? 'Ingresando…' : 'Entrar al taller'}</span>
              <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0" />
            </button>
          </form>

          <p className="mt-10 text-center text-xs font-medium text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="ml-1 font-bold text-orange-400 hover:text-orange-300 hover:underline">
              Registra tu taller
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
