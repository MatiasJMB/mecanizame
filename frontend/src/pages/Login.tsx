import { useState, useEffect } from 'react';
import { supabase } from '@/api/client';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { translateError } from '../lib/auth-errors';
import { BRAND } from '../lib/taller';

export default function Login() {
  useEffect(() => { document.title = 'Iniciar sesión — Mecanízame'; }, []);
  const { memberships, isSuperAdmin, blockedMsg, clearBlocked } = useAuth();
  const { isLight } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  if (memberships.length || isSuperAdmin) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    clearBlocked();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(translateError(error.message));
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950 p-4 text-gray-100">
      {/* halos decorativos navy/cobalto */}
      <div className="absolute left-[-12%] top-[-12%] h-[45%] w-[45%] rounded-full bg-blue-600/15 blur-[100px]" />
      <div className="absolute bottom-[-14%] right-[-10%] h-[45%] w-[45%] rounded-full bg-blue-900/40 blur-[110px]" />

      <div className="relative z-10 mx-4 flex w-full max-w-[440px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-gray-900/60 shadow-2xl backdrop-blur-2xl lg:max-w-4xl lg:flex-row">
        {/* Panel de marca */}
        <div className="flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-blue-900/40 to-transparent p-8 text-center lg:w-1/2 lg:p-12">
          <img
            src={isLight ? '/logo-mark-trans.png?v=2' : '/logo-mark-light.png?v=2'}
            alt={BRAND.name}
            className="h-28 w-28 object-contain drop-shadow-[0_10px_34px_rgba(47,90,165,0.35)] md:h-32 md:w-32"
          />
          <div>
            <h2 className="gradient-brand-text text-3xl font-black tracking-tight md:text-4xl">{BRAND.name}</h2>
            <p className="mt-2 text-sm text-gray-400">Gestión para talleres mecánicos</p>
          </div>
        </div>

        {/* Panel de formulario */}
        <div className="p-8 lg:w-1/2 lg:p-12">
          <h1 className="text-2xl font-black">Iniciar sesión</h1>
          <p className="mt-1 mb-6 text-sm text-gray-400">Accede al panel de tu taller.</p>

          {(error || blockedMsg) && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error || blockedMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Correo electrónico</label>
              <input
                id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" inputMode="email" required
                className="inp" placeholder="nombre@correo.cl"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">Contraseña</label>
              <div className="relative">
                <input
                  id="login-password" type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required
                  className="inp" style={{ paddingRight: '2.75rem' }} placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:text-white">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="mt-2 w-full rounded-xl bg-blue-600 py-3.5 font-black text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? 'Ingresando…' : 'Entrar al taller'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500">
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
