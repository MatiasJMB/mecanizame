import { useEffect, useState } from 'react';

/** Teléfono chileno: bandera + prefijo fijo +56 + 9 dígitos (validados). */
export default function PhoneInput({ value, onChange, onValidChange, required }: {
  value: string;
  onChange: (full: string) => void;
  onValidChange?: (valid: boolean) => void;
  required?: boolean;
}) {
  const [digits, setDigits] = useState(() => {
    const d = (value || '').replace(/\D/g, '');
    return (d.startsWith('56') ? d.slice(2) : d).slice(0, 9);
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onValidChange?.(digits.length === 9); }, []);

  const handle = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 9);
    setDigits(d);
    onChange(d ? `+56 ${d}` : '');
    onValidChange?.(d.length === 9);
  };

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-[color:var(--theme-input-border)] bg-[color:var(--theme-input-bg)] transition-colors focus-within:border-blue-500/60">
      <div className="flex items-center gap-2 border-r border-white/10 px-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="14" viewBox="0 0 900 600" className="shrink-0 rounded-[3px] shadow-sm">
          <rect width="900" height="600" fill="#fff" />
          <rect width="900" height="300" y="300" fill="#d52b1e" />
          <rect width="300" height="300" fill="#0039a6" />
          <path d="M150 45 L177.3 129.1 L253.1 129.1 L191.9 173.6 L215.2 257.7 L150 206.3 L84.8 257.7 L108.1 173.6 L46.9 129.1 L122.7 129.1 Z" fill="#fff" />
        </svg>
        <span className="text-sm font-bold text-white">+56</span>
      </div>
      <input
        type="tel"
        inputMode="numeric"
        value={digits}
        onChange={(e) => handle(e.target.value)}
        placeholder="9 1234 5678"
        required={required}
        autoComplete="tel-national"
        className="w-full bg-transparent px-3 py-2.5 tracking-wider tabular-nums text-white placeholder:text-gray-600 focus:outline-none"
      />
    </div>
  );
}
