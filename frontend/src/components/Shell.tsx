import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Shell({ children }: { children: ReactNode }) {
  const { organizationName, isSuperAdmin, user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-white/10 bg-gray-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 font-black">
              T
            </div>
            <div>
              <p className="text-sm font-black leading-tight">{organizationName || 'Mi Taller'}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Panel del taller</p>
            </div>
            {isSuperAdmin && (
              <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                Super admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-gray-400 sm:block">{user?.email}</span>
            <button
              onClick={signOut}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/5"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
