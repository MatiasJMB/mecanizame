import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
import Shell from './components/Shell';

function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-center text-gray-100">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-blue-500" />
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
  return (
    <ProtectedRoute>
      <Shell>
        <Outlet />
      </Shell>
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
          background: isLight ? '#ffffff' : '#1f2937',
          color: isLight ? '#211812' : '#fff',
          borderRadius: '1rem',
          fontWeight: 600,
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
        <ThemedToaster />
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
