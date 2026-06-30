import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AlertCircle } from 'lucide-react';
import { translateError } from '../lib/auth-errors';

export default function Login() {
  useEffect(() => { document.title = 'AhoraPan - Iniciar Sesión'; }, []);
  const { session } = useAuth();
  const { isLight } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(translateError(error.message));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Luces de fondo decorativas */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full" />

      <div className="max-w-[440px] lg:max-w-5xl w-full bg-gray-900/60 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[3rem] shadow-2xl p-7 md:p-12 border border-white/10 relative z-10 mx-4 flex flex-col lg:flex-row lg:items-center lg:gap-16">
        <div className="lg:w-1/2">
          <div className="text-center mb-8 lg:mb-0">
            <div className="inline-block relative mb-2">
              <div className="absolute inset-0 bg-orange-600/15 blur-2xl rounded-full scale-150 animate-pulse" />
              <img
                src={isLight ? '/logo-light.png?v=1' : '/logo.png?v=1'}
                alt="Ahora Pan Logo"
                className="w-24 h-24 md:w-32 md:h-32 mx-auto relative z-10 drop-shadow-[0_0_15px_rgba(234,88,12,0.4)] transition-transform hover:scale-105 duration-500"
              />
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-[0.9] mb-4 relative z-20">
              <span className="gradient-orange-text">
                Ahora
              </span>
              <br />
              <span className="text-white drop-shadow-md">Pan</span>
            </h2>
            <div className="flex items-center justify-center gap-2 opacity-50">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-gray-500" />
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.4em]">Gestión Digital</p>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-gray-500" />
            </div>
          </div>
        </div>
        
        <div className="lg:w-1/2">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-5">
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
            <div className="space-y-2">
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest ml-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-gray-950/50 text-white rounded-2xl px-5 py-3.5 border border-white/10 focus:outline-none focus:border-orange-500/50 focus:bg-gray-950 transition-all placeholder:text-gray-600 shadow-inner"
                placeholder="••••••••"
                required
              />
            </div>
            
            <div className="flex justify-end pr-1">
              <Link to="/recuperar" className="text-orange-500 text-xs font-bold hover:text-orange-400 transition-colors">¿Olvidaste tu contraseña?</Link>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-900/20 transition-all hover:shadow-orange-600/30 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 mt-2"
            >
              <span className="relative z-10">{loading ? 'Ingresando...' : 'Entrar a mi Panadería'}</span>
              <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />
            </button>
          </form>

          <p className="text-gray-500 text-center mt-10 text-xs font-medium">
            ¿No tienes una cuenta? <Link to="/registro" className="text-orange-500 font-bold hover:underline hover:text-orange-400 ml-1">Regístrate ahora</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
