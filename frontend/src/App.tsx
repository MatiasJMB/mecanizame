import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Products from './pages/Products';
import Schedule from './pages/Schedule';
import ResetPassword from './pages/ResetPassword';
import Terms from './pages/Terms';
import AlertUnlock from './pages/AlertUnlock';
import LiquidGlassTest from './pages/LiquidGlassTest';
import OrderNotification from './components/OrderNotification';
import SupportButton from './components/SupportButton';
import ThemeToggle from './components/ThemeToggle';
import OnboardingTour from './components/OnboardingTour';
import AlertActivationTour from './components/AlertActivationTour';
import IPhoneLiquidGlassNav from './components/IPhoneLiquidGlassNav';
import AppLayout from './components/AppLayout';

function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 scale-150 rounded-full bg-orange-500/20 blur-2xl" />
        <img src="/logo.png?v=1" alt="Ahora Pan" className="relative h-24 w-24 animate-pulseGlow rounded-3xl object-contain" />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.28em] text-theme-muted animate-pulse">
        {label || 'Preparando tu panadería…'}
      </p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const [showForceClear, setShowForceClear] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowForceClear(true), 10000);
      return () => clearTimeout(timer);
    }
    setShowForceClear(false);
  }, [loading]);

  if (loading) {
    return (
      <div className="relative">
        <FullScreenLoader />
        {showForceClear && (
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              document.cookie.split(';').forEach((c) => {
                document.cookie = c
                  .replace(/^ +/, '')
                  .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
              });
              window.location.href = '/login';
            }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 rounded-full border border-red-500/40 bg-red-500/10 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 transition-all hover:bg-red-500/20 animate-fadeIn"
          >
            ¿Pantalla atascada? Forzar limpieza
          </button>
        )}
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isAdmin } = useAuth();

  if (loading) {
    return <FullScreenLoader label="Verificando permisos…" />;
  }

  if (!session || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function ProtectedShell() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}

function AuthenticatedIPhoneNavigation() {
  const { session, loading } = useAuth();

  if (loading || !session) return null;

  return <IPhoneLiquidGlassNav />;
}

// El conmutador de tema vive dentro del AppLayout en las páginas autenticadas.
// En las páginas públicas (login, registro…) lo mostramos flotante.
const PUBLIC_PATHS = ['/login', '/registro', '/recuperar', '/reset-password', '/terminos', '/liquid-glass-test'];

function PublicThemeToggle() {
  const { pathname } = useLocation();
  if (!PUBLIC_PATHS.includes(pathname)) return null;
  return <ThemeToggle />;
}

function MainApp() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/recuperar" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terminos" element={<Terms />} />

        {/* Rutas protegidas con shell persistente (sidebar + navegación) */}
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/horarios" element={<Schedule />} />
          <Route path="/desbloquear-alerta" element={<AlertUnlock />} />
        </Route>

        <Route
          path="/liquid-glass-test"
          element={
            <ProtectedRoute>
              <LiquidGlassTest />
            </ProtectedRoute>
          }
        />

        {/* Ruta admin */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AppLayout>
                <Admin />
              </AppLayout>
            </AdminRoute>
          }
        />
      </Routes>
      <OrderNotification />
      <OnboardingTour />
      <AlertActivationTour />
      <AuthenticatedIPhoneNavigation />
      <SupportButton />
      <PublicThemeToggle />
    </BrowserRouter>
  );
}

function ThemedToaster() {
  const { isLight } = useTheme();

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: isLight ? '#ffffff' : '#1f2937',
          color: isLight ? '#211812' : '#fff',
          border: isLight ? '1px solid rgba(61, 42, 24, 0.12)' : '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: isLight ? '0 18px 50px rgba(61, 42, 24, 0.14)' : '0 18px 50px rgba(0, 0, 0, 0.45)',
          borderRadius: '1rem',
          fontWeight: 600,
        },
      }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedToaster />
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
