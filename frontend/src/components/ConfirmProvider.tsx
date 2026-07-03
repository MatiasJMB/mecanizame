import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | undefined>(undefined);

  const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setOpts(o);
  }), []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && <ConfirmDialog opts={opts} onCancel={() => close(false)} onConfirm={() => close(true)} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
  return ctx;
}

function ConfirmDialog({ opts, onCancel, onConfirm }: {
  opts: ConfirmOptions; onCancel: () => void; onConfirm: () => void;
}) {
  useBodyScrollLock();
  const danger = opts.danger ?? true;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="animate-scaleIn w-full max-w-sm rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black">{opts.title ?? '¿Confirmar?'}</h3>
            {opts.message && <p className="mt-1 text-sm leading-relaxed text-gray-400">{opts.message}</p>}
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold hover:bg-white/5">
            {opts.cancelText ?? 'Cancelar'}
          </button>
          <button onClick={onConfirm} autoFocus
            className={`flex-1 rounded-xl py-2.5 text-sm font-black text-white ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {opts.confirmText ?? (danger ? 'Sí, eliminar' : 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  );
}
