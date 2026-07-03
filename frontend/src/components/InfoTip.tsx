import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { HelpContent } from '../lib/help';

/** Botón (i) con ayuda contextual. Se cierra al hacer clic fuera o con Escape. */
export default function InfoTip({ help }: { help: HelpContent }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Cómo usar esta sección"
        aria-expanded={open}
        className="grid h-6 w-6 place-items-center rounded-full border border-white/15 text-gray-400 transition-colors hover:border-blue-400/50 hover:text-blue-300"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className="animate-scaleIn absolute left-0 top-8 z-40 w-[19rem] max-w-[calc(100vw-2rem)] origin-top-left rounded-xl border border-white/10 bg-gray-900 p-4"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          <p id={titleId} className="mb-2 text-sm font-black">{help.title}</p>
          <ul className="space-y-1.5 pl-4 text-xs leading-relaxed text-gray-400" style={{ listStyle: 'disc' }}>
            {help.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
