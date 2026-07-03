import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Action = { label: string; onClick?: () => void; to?: string; icon?: ReactNode };

/** Estado vacío con guía: icono + título + explicación + acción sugerida.
 *  Siempre le dice al usuario cuál es el siguiente paso. */
export default function EmptyState({ icon: Icon, title, description, action, secondary, compact }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: Action;    // botón primario (azul)
  secondary?: Action; // botón secundario (borde)
  compact?: boolean;  // padding reducido para paneles internos
}) {
  return (
    <div className={`rounded-2xl border border-dashed border-white/15 bg-gray-900/40 text-center ${compact ? 'p-6' : 'p-10'}`}>
      <Icon className={`mx-auto text-gray-600 ${compact ? 'h-7 w-7' : 'h-10 w-10'}`} />
      <p className="mt-3 font-bold">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">{description}</p>}
      {(action || secondary) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {action && <ActionBtn a={action} primary />}
          {secondary && <ActionBtn a={secondary} />}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ a, primary }: { a: Action; primary?: boolean }) {
  const cls = primary
    ? 'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-500'
    : 'inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/5';
  return a.to
    ? <Link to={a.to} className={cls}>{a.icon}{a.label}</Link>
    : <button onClick={a.onClick} className={cls}>{a.icon}{a.label}</button>;
}
