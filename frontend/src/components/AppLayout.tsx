import { createContext, useContext, useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  House,
  ShoppingBag,
  CalendarClock,
  Megaphone,
  UserRound,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

const isIPhoneUserAgent = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /\b(iPhone|iPad|iPod)\b/i.test(navigator.userAgent)
    || (/\bMacintosh\b/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

/* ===== Slot de cabecera: cada página inyecta su título + acciones en la
   ÚNICA barra superior (junto a tema + sesión), evitando barras duplicadas. ===== */
type PageHeaderSlot = { title?: ReactNode; actions?: ReactNode };
const SetHeaderSlotCtx = createContext<(slot: PageHeaderSlot | null) => void>(() => {});

export function usePageHeader(slot: PageHeaderSlot, deps: DependencyList) {
  const setSlot = useContext(SetHeaderSlotCtx);
  useEffect(() => {
    setSlot(slot);
    return () => setSlot(null);
    // El llamador controla cuándo refrescar el slot mediante `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

type NavEntry = {
  label: string;
  to: string;
  icon: ReactNode;
  match: (path: string) => boolean;
  adminOnly?: boolean;
};

const NAV: NavEntry[] = [
  { label: 'Inicio', to: '/', icon: <House className="h-5 w-5" />, match: (p) => p === '/' || p === '/liquid-glass-test' },
  { label: 'Catálogo', to: '/productos', icon: <ShoppingBag className="h-5 w-5" />, match: (p) => p.startsWith('/productos') },
  { label: 'Horarios', to: '/horarios', icon: <CalendarClock className="h-5 w-5" />, match: (p) => p.startsWith('/horarios') },
  { label: 'Alerta Pan', to: '/desbloquear-alerta', icon: <Megaphone className="h-5 w-5" />, match: (p) => p.startsWith('/desbloquear-alerta') },
  { label: 'Mi perfil', to: '/perfil', icon: <UserRound className="h-5 w-5" />, match: (p) => p === '/perfil' },
  { label: 'Administración', to: '/admin', icon: <ShieldCheck className="h-5 w-5" />, match: (p) => p.startsWith('/admin'), adminOnly: true },
];

function Brand({ name }: { name: string }) {
  const { isLight } = useTheme();
  return (
    <Link to="/" className="group flex items-center gap-3 min-w-0">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 transition-transform group-hover:scale-105">
        <img src={isLight ? '/logo-light.png?v=1' : '/logo.png?v=1'} alt="Ahora Pan" className="h-7 w-7 object-contain" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-black tracking-tight text-theme-base">
          {name || 'Ahora Pan'}
        </span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-theme-muted">
          Ahora Pan
        </span>
      </span>
    </Link>
  );
}

function NavList({ pathname, isAdmin, onNavigate }: { pathname: string; isAdmin: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1.5">
      {NAV.filter((e) => !e.adminOnly || isAdmin).map((entry) => {
        const active = entry.match(pathname);
        return (
          <Link
            key={entry.to}
            to={entry.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cx('app-nav-item text-[13px]', active && 'is-active')}
          >
            <span className="shrink-0">{entry.icon}</span>
            <span className="truncate">{entry.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SessionMenu({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const ref = useRef<HTMLDivElement | null>(null);

  // Cerrar al navegar
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-theme py-1.5 pl-1.5 pr-2 transition-colors hover:border-orange-500/40"
        style={{ backgroundColor: 'var(--theme-inset)' }}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10 text-orange-500">
          <UserRound className="h-4 w-4" />
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-theme-muted leading-none">Sesión</span>
          <span className="block max-w-[150px] truncate text-xs font-bold text-theme-base leading-tight">{email || 'Mi cuenta'}</span>
        </span>
        <ChevronDown className={cx('h-4 w-4 text-theme-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-theme bg-theme-panel shadow-[0_18px_50px_var(--theme-shadow)] animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="border-b border-theme px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-theme-muted">Sesión iniciada</p>
            <p className="truncate text-sm font-bold text-theme-base">{email || 'Mi cuenta'}</p>
          </div>
          <Link
            to="/perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-theme-base transition-colors hover:bg-[var(--theme-overlay)]"
          >
            <UserRound className="h-4 w-4 text-orange-500" /> Mi perfil
          </Link>
          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            className="flex w-full items-center gap-3 border-t border-theme px-4 py-3 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { bakeryName, isAdmin, user, signOut } = useAuth();
  const location = useLocation();
  const [isIPhone, setIsIPhone] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<PageHeaderSlot | null>(null);

  useEffect(() => { setIsIPhone(isIPhoneUserAgent()); }, []);

  // Cerrar el drawer al navegar
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [drawerOpen]);

  const showDesktopSidebar = !isIPhone;

  return (
    <SetHeaderSlotCtx.Provider value={setHeaderSlot}>
    <div className="app-shell min-h-screen">
      {/* ===== Sidebar persistente (solo navegación) — desktop, no-iPhone ===== */}
      {showDesktopSidebar && (
        <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r lg:flex">
          <div className="px-5 pt-6 pb-5">
            <Brand name={bakeryName} />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-5">
            <p className="app-nav-section mb-2 px-3">Menú</p>
            <NavList pathname={location.pathname} isAdmin={isAdmin} />
          </div>
        </aside>
      )}

      {/* ===== Contenido + ÚNICA barra superior ===== */}
      <div className={cx(showDesktopSidebar && 'lg:pl-[264px]')}>
        <header
          className="app-topbar sticky top-0 z-30 flex min-h-[3.5rem] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-3 py-2 md:px-5 lg:h-14 lg:flex-nowrap lg:py-0"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {/* Hamburguesa: móvil (no-iPhone) e iPhone — abre el drawer de navegación */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              className={cx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-theme text-theme-base transition-colors hover:text-orange-500',
                showDesktopSidebar && 'lg:hidden',
              )}
              style={{ backgroundColor: 'var(--theme-inset)' }}
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Título de la página (slot) o marca cuando no hay sidebar visible */}
            {headerSlot?.title ? (
              <div className="min-w-0 flex-1">{headerSlot.title}</div>
            ) : (
              <div className={cx('min-w-0', showDesktopSidebar && 'lg:hidden')}>
                <Brand name={bakeryName} />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {headerSlot?.actions}
            <ThemeToggle inline />
            <SessionMenu email={user?.email} onSignOut={signOut} />
          </div>
        </header>

        {children}
      </div>

      {/* ===== Drawer (navegación, móvil/iPhone) ===== */}
      {drawerOpen && (
        <div className={cx('fixed inset-0 z-[80]', showDesktopSidebar && 'lg:hidden')}>
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="app-sidebar absolute inset-y-0 left-0 flex w-[280px] max-w-[84vw] flex-col border-r animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-5 pb-5" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
              <Brand name={bakeryName} />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-theme text-theme-muted hover:text-theme-base"
                style={{ backgroundColor: 'var(--theme-inset)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
              <p className="app-nav-section mb-2 px-3">Menú</p>
              <NavList pathname={location.pathname} isAdmin={isAdmin} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </div>
    </SetHeaderSlotCtx.Provider>
  );
}
