import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Panel from './pages/Panel';
import Clientes from './pages/Clientes';
import Servicios from './pages/Servicios';
import Ordenes from './pages/Ordenes';
import Finanzas from './pages/Finanzas';
import Admin from './pages/Admin';
import Equipo from './pages/Equipo';
import Shell from './components/Shell';
import NoWorkshop from './components/NoWorkshop';
import { ConfirmProvider } from './components/ConfirmProvider';
import { SearchProvider } from './context/SearchContext';
import { TourProvider } from './components/TourProvider';

function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-center text-gray-100">
      <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
      <p className="text-xs font-black uppercase tracking-[0.28em] text-gray-500">
        {label || 'Cargando…'}
      </p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ProtectedShell() {
  // Con multi-taller, una cuenta puede quedar temporalmente sin talleres (recién creada,
  // o tras salir de su único taller). En vez de desloguear, se ofrece crear/unirse a uno.
  const { needsOnboarding } = useAuth();
  return (
    <ProtectedRoute>
      {needsOnboarding ? (
        <NoWorkshop />
      ) : (
        <SearchProvider>
          <TourProvider>
            <Shell>
              <Outlet />
            </Shell>
          </TourProvider>
        </SearchProvider>
      )}
    </ProtectedRoute>
  );
}

function ThemedToaster() {
  const { isLight } = useTheme();
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: isLight ? 'var(--theme-panel-strong)' : 'var(--theme-card)',
          color: 'var(--theme-heading)',
          border: '1px solid var(--theme-border)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: '1rem',
          fontWeight: 700,
        },
      }}
    />
  );
}

function MainApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Panel />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/servicios" element={<Servicios />} />
          <Route path="/ordenes" element={<Ordenes />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/equipo" element={<Equipo />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmProvider>
          <ThemedToaster />
          <MainApp />
        </ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
