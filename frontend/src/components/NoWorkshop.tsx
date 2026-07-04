import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import WorkshopEntryModal from './WorkshopEntryModal';
import { BRAND } from '../lib/taller';
import { Store, KeyRound } from 'lucide-react';

/** Pantalla para una cuenta sin talleres (recién creada, o tras salir de su único taller).
 *  No se desloguea: ofrece crear un taller o unirse a uno con un código. */
export default function NoWorkshop() {
  const { refreshMemberships, signOut } = useAuth();
  const { isLight } = useTheme();
  const [entry, setEntry] = useState<'create' | 'join' | null>(null);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950 p-4 text-gray-100">
      <div className="absolute left-[-12%] top-[-12%] h-[45%] w-[45%] rounded-full bg-blue-600/15 blur-[100px]" />
      <div className="absolute bottom-[-14%] right-[-10%] h-[45%] w-[45%] rounded-full bg-blue-900/40 blur-[110px]" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/60 p-8 text-center shadow-2xl backdrop-blur-2xl">
        <img src={isLight ? '/logo-mark-trans.png?v=2' : '/logo-mark-light.png?v=2'} alt={BRAND.name} className="mx-auto mb-3 h-14 w-14 object-contain" />
        <h1 className="text-2xl font-black">No perteneces a ningún taller</h1>
        <p className="mx-auto mt-1 max-w-xs text-sm text-gray-400">Crea tu propio taller o únete a uno existente con el código que te compartieron.</p>

        <div className="mt-6 space-y-2">
          <button onClick={() => setEntry('create')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white transition-colors hover:bg-blue-500">
            <Store className="h-4 w-4" /> Crear un taller
          </button>
          <button onClick={() => setEntry('join')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-bold text-gray-300 transition-colors hover:bg-white/5">
            <KeyRound className="h-4 w-4" /> Unirme con un código
          </button>
        </div>

        <button onClick={signOut} className="mt-6 text-xs text-gray-500 hover:text-gray-300 hover:underline">
          Cerrar sesión
        </button>
      </div>

      {entry && <WorkshopEntryModal initialMode={entry} onClose={() => setEntry(null)} onDone={refreshMemberships} />}
    </div>
  );
}
