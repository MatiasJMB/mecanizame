import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ inline = false }: { inline?: boolean }) {
  const { isLight, toggleTheme } = useTheme();

  if (inline) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-theme text-theme-base transition-colors hover:text-orange-500 active:scale-95"
        style={{ backgroundColor: 'var(--theme-inset)' }}
        aria-label={isLight ? 'Activar modo oscuro' : 'Activar modo claro'}
        title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      >
        {isLight ? <Moon className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle fixed right-4 top-3 lg:right-6 lg:top-5 z-[10000] inline-flex h-9 lg:h-11 items-center gap-2 rounded-xl lg:rounded-2xl border px-2.5 lg:px-3.5 text-[10px] lg:text-xs font-black uppercase tracking-[0.16em] transition-all duration-300 active:scale-95"
      aria-label={isLight ? 'Activar modo oscuro' : 'Activar modo claro'}
      title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
    >
      <span className="theme-toggle-icon flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-lg md:rounded-xl">
        {isLight ? <Moon className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <SunMedium className="h-3.5 w-3.5 md:h-4 md:w-4" />}
      </span>
      <span className="hidden md:inline">{isLight ? 'Oscuro' : 'Claro'}</span>
    </button>
  );
}
