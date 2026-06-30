import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { translateError } from '../lib/auth-errors';

export default function ResetPassword() {
  useEffect(() => { document.title = 'AhoraPan - Nueva Contraseña'; }, []);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(translateError(error.message));
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full" />

      <div className="max-w-[440px] w-full bg-gray-900/60 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[3rem] shadow-2xl p-7 md:p-12 border border-white/10 relative z-10 mx-4">
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20 mb-4">
            <Lock className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter leading-none mb-2">Nueva Contraseña</h2>
          <p className="text-gray-400 text-sm">Establece tu nueva clave de acceso</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center py-4 animate-fadeIn">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-6 rounded-3xl mb-6 flex flex-col items-center gap-3">
              <CheckCircle2 className="w-12 h-12 mb-2" />
              <p className="font-black text-lg">¡Contraseña Actualizada!</p>
              <p className="text-sm opacity-80">Redirigiéndote al inicio de sesión...</p>
            </div>
            <Link to="/login" className="text-orange-500 font-bold hover:underline">Ir al Login ahora</Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest ml-1">Contraseña Nueva</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full bg-gray-950/50 text-white rounded-2xl px-5 py-3.5 border border-white/10 focus:outline-none focus:border-orange-500/50 focus:bg-gray-950 transition-all shadow-inner pr-12 placeholder:text-gray-600"
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-orange-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest ml-1">Confirmar Contraseña</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-gray-950/50 text-white rounded-2xl px-5 py-3.5 border border-white/10 focus:outline-none focus:border-orange-500/50 focus:bg-gray-950 transition-all shadow-inner placeholder:text-gray-600"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-900/20 transition-all hover:shadow-orange-600/30 active:scale-[0.98] disabled:opacity-50 mt-2"
            >
              {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link to="/login" className="text-gray-500 text-xs font-bold hover:text-orange-500 transition-colors uppercase tracking-widest">
            Cancelar y volver
          </Link>
        </div>
      </div>
    </div>
  );
}
