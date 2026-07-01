import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import { LayoutDashboard, Users, Wrench, ClipboardList, Wallet, ShieldCheck, LogOut } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/clientes', label: 'Clientes', icon: Users, end: false },
  { to: '/servicios', label: 'Servicios', icon: Wrench, end: false },
  { to: '/ordenes', label: 'Órdenes', icon: ClipboardList, end: false },
  { to: '/finanzas', label: 'Finanzas', icon: Wallet, end: false },
];

function Brand() {
  const { isLight } = useTheme();
  // marca navy sobre fondos claros; marca clara sobre fondos oscuros.
  const src = isLight ? '/logo-mark-trans.png?v=2' : '/logo-mark-light.png?v=2';
  return (
    <div className="flex items-center gap-2.5">
      <img src={src} alt="" className="h-9 w-9 shrink-0 object-contain" />
      <div className="leading-tight">
        <p className="text-sm font-black text-gray-100">Taller <span className="gradient-brand-text">Mecánico</span></p>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Diésel · Diagnóstico</p>
      </div>
    </div>
  );
}

function NavItems({ isSuperAdmin, onNavigate }: { isSuperAdmin: boolean; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate}
          className={({ isActive }) => `app-nav-item ${isActive ? 'is-active' : ''}`}>
          <n.icon className="h-[18px] w-[18px]" /> {n.label}
        </NavLink>
      ))}
      {isSuperAdmin && (
        <NavLink to="/admin" onClick={onNavigate}
          className={({ isActive }) => `app-nav-item ${isActive ? 'is-active' : ''}`}>
          <ShieldCheck className="h-[18px] w-[18px]" /> Talleres
          <span className="ml-auto rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">Admin</span>
        </NavLink>
      )}
    </>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { organizationName, isSuperAdmin, user, signOut } = useAuth();

  return (
    <div className="app-shell min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-60 flex-col border-r px-4 py-5 lg:flex">
        <Brand />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          <NavItems isSuperAdmin={isSuperAdmin} />
        </nav>
        <div className="space-y-3 border-t border-white/10 pt-4">
          <ThemeToggle />
          <div>
            {isSuperAdmin && (
              <span className="mb-1.5 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                Super admin
              </span>
            )}
            <p className="truncate text-xs font-bold text-gray-300">{organizationName || 'Mi Taller'}</p>
            <p className="truncate text-[11px] text-gray-500">{user?.email}</p>
          </div>
          <button onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 transition-colors hover:bg-white/5">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Topbar (móvil) */}
      <header className="app-topbar sticky top-0 z-30 border-b lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <button onClick={signOut} title="Cerrar sesión"
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          <NavItemsMobile isSuperAdmin={isSuperAdmin} />
        </nav>
      </header>

      {/* Contenido */}
      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

function NavItemsMobile({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const items = [...NAV, ...(isSuperAdmin ? [{ to: '/admin', label: 'Talleres', icon: ShieldCheck, end: false }] : [])];
  return (
    <>
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end}
          className={({ isActive }) =>
            `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${isActive ? 'bg-blue-500/15 text-blue-400' : 'text-gray-400'}`}>
          <n.icon className="h-4 w-4" /> {n.label}
        </NavLink>
      ))}
    </>
  );
}
