import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSearch } from '../context/SearchContext';
import { useTour } from './TourProvider';
import ThemeToggle from './ThemeToggle';
import BillingBanner from './BillingBanner';
import OrgSwitcher from './OrgSwitcher';
import SuspendedGate from './SuspendedGate';
import { canManageTeam, canSeeFinanzas } from '../lib/roles';
import { LayoutDashboard, Users, Users2, Wrench, ClipboardList, Wallet, ShieldCheck, LogOut, Search, X, HelpCircle } from 'lucide-react';

type NavGate = 'team' | 'finance';
type NavEntry = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; gate?: NavGate };
type NavPerms = { team: boolean; finance: boolean; admin: boolean };
const navVisible = (n: NavEntry, p: NavPerms) => !n.gate || (n.gate === 'team' ? p.team : p.finance);

// El orden de los grupos refleja el flujo real del taller:
// catálogo → clientes → órdenes. Sin números: el orden ES el flujo.
const NAV_GROUPS: { label?: string; items: NavEntry[] }[] = [
  { items: [{ to: '/', label: 'Resumen', icon: LayoutDashboard, end: true }] },
  {
    label: 'Tu taller',
    items: [
      { to: '/servicios', label: 'Servicios', icon: Wrench },
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/ordenes', label: 'Órdenes', icon: ClipboardList },
    ],
  },
  { label: 'Gestión', items: [{ to: '/equipo', label: 'Equipo', icon: Users2, gate: 'team' }] },
  { label: 'Análisis', items: [{ to: '/finanzas', label: 'Finanzas', icon: Wallet, gate: 'finance' }] },
];

// Lista plana para la nav móvil (hereda el mismo orden).
const NAV = NAV_GROUPS.flatMap((g) => g.items);

// Páginas donde el buscador global aplica, con su placeholder contextual.
const SEARCH_PAGES: Record<string, string> = {
  '/clientes': 'Buscar cliente, teléfono o patente…',
  '/servicios': 'Buscar servicio…',
  '/ordenes': 'Buscar por cliente, patente o código OT…',
};

/** Buscador global: filtra la página activa. Se renderiza en desktop y móvil;
 *  ambos comparten el estado del SearchContext. */
function GlobalSearch({ variant }: { variant: 'desktop' | 'mobile' }) {
  const { pathname } = useLocation();
  const { query, setQuery } = useSearch();
  const placeholder = SEARCH_PAGES[pathname];

  // Atajo "/" o Ctrl/Cmd+K: enfoca el buscador visible (solo lo registra el desktop
  // para no duplicar listeners; enfoca el input visible según el viewport).
  useEffect(() => {
    if (variant !== 'desktop') return;
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        const inputs = document.querySelectorAll<HTMLInputElement>('[data-tour="buscador-global"] input');
        const visible = [...inputs].find((i) => i.offsetParent !== null);
        if (visible) { e.preventDefault(); visible.focus(); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [variant]);

  if (!placeholder) return null;

  const input = (
    <div className="relative" data-tour="buscador-global">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      <input value={query} onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); (e.target as HTMLInputElement).blur(); } }}
        placeholder={placeholder} aria-label="Buscar en esta sección"
        className="w-full rounded-xl border border-white/10 bg-gray-950/60 py-2.5 pl-9 pr-9 text-sm placeholder:text-gray-600 focus:outline-none" />
      {query && (
        <button onClick={() => setQuery('')} title="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return variant === 'desktop' ? (
    <div className="app-searchbar hidden border-b px-6 py-2.5 lg:block">
      <div className="mx-auto max-w-6xl">{input}</div>
    </div>
  ) : (
    <div className="px-4 pb-2.5 lg:hidden">{input}</div>
  );
}

function Brand() {
  const { isLight } = useTheme();
  // marca navy sobre fondos claros; marca clara sobre fondos oscuros.
  const src = isLight ? '/logo-mark-trans.png?v=2' : '/logo-mark-light.png?v=2';
  return (
    <div className="flex items-center gap-2.5">
      <img src={src} alt="" className="h-9 w-9 shrink-0 object-contain" />
      <div className="leading-tight">
        <p className="text-base font-black"><span className="gradient-brand-text">Mecanízame</span></p>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Gestión de taller</p>
      </div>
    </div>
  );
}

function NavItems({ perms, onNavigate }: { perms: NavPerms; onNavigate?: () => void }) {
  return (
    <>
      {NAV_GROUPS.map((g, i) => {
        const items = g.items.filter((n) => navVisible(n, perms));
        if (items.length === 0) return null;
        return (
          <div key={g.label ?? i}>
            {g.label && <p className="app-nav-group-label">{g.label}</p>}
            <div className="flex flex-col gap-1">
              {items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate}
                  className={({ isActive }) => `app-nav-item ${isActive ? 'is-active' : ''}`}>
                  <n.icon className="h-[18px] w-[18px]" /> {n.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
      {perms.admin && (
        <div>
          <p className="app-nav-group-label">Administración</p>
          <NavLink to="/admin" onClick={onNavigate}
            className={({ isActive }) => `app-nav-item ${isActive ? 'is-active' : ''}`}>
            <ShieldCheck className="h-[18px] w-[18px]" /> Talleres
            <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
              style={{ background: 'var(--state-pending-bg)', color: 'var(--state-pending-text)' }}>Admin</span>
          </NavLink>
        </div>
      )}
    </>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { organizationName, isSuperAdmin, isImpersonating, stopImpersonating, user, signOut, activeOrgSuspended, activeOrgPending, role } = useAuth();
  const { start: startTour } = useTour();
  const perms: NavPerms = { team: isSuperAdmin || canManageTeam(role), finance: isSuperAdmin || canSeeFinanzas(role), admin: isSuperAdmin };

  return (
    <div className="app-shell min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-60 flex-col border-r px-4 py-5 lg:flex">
        <Brand />
        <nav className="custom-scrollbar mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1" data-tour="nav">
          <NavItems perms={perms} />
        </nav>
        <div className="shrink-0 space-y-2 border-t border-white/10 pt-3">
          <button onClick={startTour} data-tour="ayuda"
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 transition-colors hover:bg-white/5">
            <HelpCircle className="h-4 w-4" /> ¿Cómo funciona?
          </button>
          <ThemeToggle />
          {isSuperAdmin ? (
            <div>
              <span className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: 'var(--state-pending-bg)', color: 'var(--state-pending-text)' }}>
                Super admin
              </span>
              <p className="truncate text-xs font-bold text-gray-300">{organizationName || 'Administración'}</p>
              <p className="truncate text-[11px] text-gray-500">{user?.email}</p>
            </div>
          ) : (
            <OrgSwitcher variant="desktop" />
          )}
          <button onClick={signOut}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 transition-colors hover:bg-white/5">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Topbar (móvil) */}
      <header className="app-topbar sticky top-0 z-30 border-b lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <div className="flex items-center gap-2">
            <button onClick={startTour} title="¿Cómo funciona?" data-tour="ayuda"
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">
              <HelpCircle className="h-4 w-4" />
            </button>
            <ThemeToggle compact />
            <button onClick={signOut} title="Cerrar sesión"
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="px-4 pb-2"><OrgSwitcher variant="mobile" /></div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" data-tour="nav">
          <NavItemsMobile perms={perms} />
        </nav>
        <GlobalSearch variant="mobile" />
      </header>

      {/* Contenido */}
      <main className="lg:pl-60">
        {/* Un solo contenedor sticky: admin-bar y buscador se apilan sin pisarse. */}
        <div className="lg:sticky lg:top-0 lg:z-20">
          {isImpersonating && (
            <div className="admin-bar flex items-center justify-between gap-3 border-b px-4 py-2 text-xs font-bold lg:backdrop-blur">
              <span className="flex items-center gap-1.5 truncate">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Viendo <span className="font-black">{organizationName}</span> como administrador
              </span>
              <button onClick={stopImpersonating}
                className="admin-bar-btn shrink-0 rounded-lg border px-2.5 py-1 transition-colors">
                Salir del taller
              </button>
            </div>
          )}
          <BillingBanner />
          <GlobalSearch variant="desktop" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8">{(activeOrgSuspended || activeOrgPending) ? <SuspendedGate /> : children}</div>
      </main>
    </div>
  );
}

function NavItemsMobile({ perms }: { perms: NavPerms }) {
  const items: NavEntry[] = [
    ...NAV.filter((n) => navVisible(n, perms)),
    ...(perms.admin ? [{ to: '/admin', label: 'Talleres', icon: ShieldCheck, end: false } as NavEntry] : []),
  ];
  return (
    <>
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end}
          className={({ isActive }) =>
            `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${isActive ? 'bg-blue-500/15 text-blue-400' : 'text-gray-400'}`}>
          <n.icon className="h-[18px] w-[18px]" /> {n.label}
        </NavLink>
      ))}
    </>
  );
}
