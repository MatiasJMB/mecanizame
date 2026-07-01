import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { isLight, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      title={isLight ? 'Modo oscuro' : 'Modo claro'}
      className={
        compact
          ? 'grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-gray-300 transition-colors hover:bg-white/5'
          : 'flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 transition-colors hover:bg-white/5'
      }
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!compact && <span>{isLight ? 'Modo oscuro' : 'Modo claro'}</span>}
    </button>
  );
}
