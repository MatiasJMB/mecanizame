import React, { useState, useEffect } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  required?: boolean;
  className?: string;
}

export default function PhoneInput({ value, onChange, required = false, className = '' }: PhoneInputProps) {
  const [localNumber, setLocalNumber] = useState('');
  const prefix = '+56 9';
  const cleanPrefix = '+569';

  useEffect(() => {
    if (value && !localNumber) {
      if (value.startsWith(cleanPrefix)) {
        setLocalNumber(value.replace(cleanPrefix, ''));
      }
    }
  }, [value]);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
    setLocalNumber(val);
    onChange(`${cleanPrefix}${val}`);
  };

  return (
    <div className={`relative flex items-center group ${className}`}>
      {/* Prefijo Fijo Chile con Bandera SVG */}
      <div className="absolute left-4 z-10 flex items-center gap-2 pointer-events-none border-r border-white/10 pr-3 h-7">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="14" viewBox="0 0 900 600" className="rounded-[3px] shadow-sm shrink-0">
          <rect width="900" height="600" fill="#fff"/>
          <rect width="900" height="300" y="300" fill="#d52b1e"/>
          <rect width="300" height="300" fill="#0039a6"/>
          <path d="M150 45 L177.3 129.1 L253.1 129.1 L191.9 173.6 L215.2 257.7 L150 206.3 L84.8 257.7 L108.1 173.6 L46.9 129.1 L122.7 129.1 Z" fill="#fff"/>
        </svg>
        <span className="text-sm font-black text-white tracking-tight tabular-nums">{prefix}</span>
      </div>

      <input
        type="tel"
        inputMode="numeric"
        value={localNumber}
        onChange={handleNumberChange}
        placeholder="1234 5678"
        required={required}
        autoComplete="tel-national"
        className="w-full bg-gray-950/50 text-white rounded-xl pl-[110px] pr-4 py-3.5 border border-white/10 focus:outline-none focus:border-orange-500/50 focus:bg-gray-950 transition-all placeholder:text-gray-600 shadow-inner font-medium tracking-wider tabular-nums"
      />
    </div>
  );
}
