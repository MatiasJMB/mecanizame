import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { translateError } from '../lib/auth-errors';

export default function ForgotPassword() {
  useEffect(() => { document.title = 'AhoraPan - Recuperar Contraseña'; }, []);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });

    if (error) {
      setError(translateError(error.message));
    } else {
      setMessage('Te hemos enviado un enlace de recuperación a tu correo electrónico.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full" />

      <div className="max-w-[440px] w-full bg-gray-900/60 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[3rem] shadow-2xl p-7 md:p-12 border border-white/10 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20 mb-4">
            <KeyRound className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Recuperar Acceso</h2>
          <p className="text-gray-400 text-sm">
            Ingresa el correo con el que registraste tu panadería
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}
        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 font-bold">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {message}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest ml-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              className="w-full bg-gray-950/50 text-white rounded-2xl px-5 py-3.5 border border-white/10 focus:outline-none focus:border-orange-500/50 focus:bg-gray-950 transition-all placeholder:text-gray-600 shadow-inner"
              placeholder="admin@panaderia.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-900/20 transition-all hover:shadow-orange-600/30 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 mt-2"
          >
            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <p className="text-gray-500 text-center mt-8 text-sm">
          Volver a <Link to="/login" className="text-orange-500 font-bold hover:underline hover:text-orange-400 ml-1">Iniciar Sesión</Link>
        </p>
      </div>
    </div>
  );
}
