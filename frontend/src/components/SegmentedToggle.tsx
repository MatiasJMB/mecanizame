import type { ReactNode } from 'react';

/** Toggle segmentado reutilizable (Lista/Calendario, Grid/Lista, etc.). */
export default function SegmentedToggle<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-gray-950/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            value === o.v ? 'bg-blue-500/15 text-blue-300' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
