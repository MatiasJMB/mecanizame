import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TOUR_STEPS, tourStorageKey } from '../lib/tour';

// Tour de bienvenida sin dependencias: overlay con "spotlight" (box-shadow gigante)
// sobre elementos marcados con data-tour="...". Persiste en localStorage por usuario.

type TourContextValue = { start: () => void; active: boolean };
const TourContext = createContext<TourContextValue>({ start: () => {}, active: false });

// eslint-disable-next-line react-refresh/only-export-components
export function useTour() {
  return useContext(TourContext);
}

type Rect = { top: number; left: number; width: number; height: number };

const CARD_W = 340;
const CARD_H_EST = 220;
const PAD = 6;

export function TourProvider({ children }: { children: ReactNode }) {
  const { user, isImpersonating } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false); // false mientras se espera el ancla
  const cardRef = useRef<HTMLDivElement>(null);

  const active = stepIndex !== null;
  const step = stepIndex !== null ? TOUR_STEPS[stepIndex] : null;

  const start = useCallback(() => { setReady(false); setRect(null); setStepIndex(0); }, []);
  const finish = useCallback(() => {
    if (user?.id) localStorage.setItem(tourStorageKey(user.id), 'done');
    setStepIndex(null);
  }, [user?.id]);

  const goTo = useCallback((i: number) => {
    if (i >= TOUR_STEPS.length) { finish(); return; }
    if (i < 0) return;
    setReady(false);
    setRect(null);
    setStepIndex(i);
  }, [finish]);

  // Auto-lanzamiento la primera vez (no al super admin revisando un taller ajeno).
  useEffect(() => {
    if (!user?.id || isImpersonating) return;
    if (localStorage.getItem(tourStorageKey(user.id))) return;
    const t = setTimeout(() => start(), 800);
    return () => clearTimeout(t);
  }, [user?.id, isImpersonating, start]);

  // Resolver el paso actual: navegar si hace falta, esperar el ancla, medirla.
  useEffect(() => {
    if (stepIndex === null) return;
    const s = TOUR_STEPS[stepIndex];
    let cancelled = false;
    let removeListeners: (() => void) | null = null;

    const findEl = () => {
      const els = document.querySelectorAll<HTMLElement>(`[data-tour="${s.id}"]`);
      // Hay anclas duplicadas (nav desktop/móvil): usar la visible.
      return [...els].find((el) => el.offsetParent !== null) ?? null;
    };
    const measure = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };

    (async () => {
      if (!s.id) { setRect(null); setReady(true); return; } // paso centrado
      if (s.route && s.route !== pathname) { navigate(s.route); return; } // el cambio de ruta re-dispara el efecto

      // La página puede estar cargando datos: esperar el ancla hasta 3 s.
      const deadline = Date.now() + 3000;
      let el = findEl();
      while (!el && Date.now() < deadline && !cancelled) {
        await new Promise((r) => setTimeout(r, 100));
        el = findEl();
      }
      if (cancelled) return;
      if (!el) {
        if (s.optional) { goTo(stepIndex + 1); return; } // sin ancla → saltar
        setRect(null); setReady(true); return;           // fallback: tarjeta centrada
      }
      el.scrollIntoView({ block: 'center', inline: 'center' });
      measure(el);
      setReady(true);
      const onMove = () => { const e2 = findEl(); if (e2) measure(e2); };
      window.addEventListener('resize', onMove);
      window.addEventListener('scroll', onMove, true);
      removeListeners = () => { window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); };
    })();

    return () => { cancelled = true; removeListeners?.(); };
  }, [stepIndex, pathname, navigate, goTo]);

  // Teclado y foco.
  useEffect(() => {
    if (stepIndex === null) return;
    cardRef.current?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') goTo(stepIndex + 1);
      if (e.key === 'ArrowLeft') goTo(stepIndex - 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [stepIndex, ready, finish, goTo]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const cardStyle: CSSProperties = {};
  let cardClass = 'absolute w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-gray-900 p-5 shadow-2xl outline-none';
  if (isMobile) {
    cardClass = 'absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-gray-900 p-5 pb-7 shadow-2xl outline-none';
  } else if (rect) {
    const below = rect.top + rect.height + 12;
    const fitsBelow = below + CARD_H_EST < window.innerHeight;
    cardStyle.top = fitsBelow ? below : Math.max(16, rect.top - CARD_H_EST - 12);
    cardStyle.left = Math.min(Math.max(16, rect.left), window.innerWidth - CARD_W - 16);
  } else {
    cardStyle.top = '50%';
    cardStyle.left = '50%';
    cardStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <TourContext.Provider value={{ start, active }}>
      {children}
      {active && step && (
        <div className="fixed inset-0 z-[70]">
          {rect ? (
            <div className="absolute rounded-xl transition-all duration-300"
              style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 9999px rgba(4, 8, 18, 0.74)' }} />
          ) : (
            <div className="absolute inset-0 bg-black/75" />
          )}
          {ready && (
            <div ref={cardRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-title"
              className={`animate-scaleIn ${cardClass}`} style={cardStyle}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300">
                Paso {stepIndex! + 1} de {TOUR_STEPS.length}
              </p>
              <h3 id="tour-title" className="mt-1 text-lg font-black text-white">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-300">{step.body}</p>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={finish} className="text-xs font-bold text-gray-500 hover:text-gray-300">Saltar tour</button>
                <div className="ml-auto flex gap-2">
                  {stepIndex! > 0 && (
                    <button onClick={() => goTo(stepIndex! - 1)}
                      className="rounded-xl border border-white/10 px-3.5 py-2 text-sm font-bold text-gray-200 hover:bg-white/5">
                      Atrás
                    </button>
                  )}
                  <button onClick={() => goTo(stepIndex! + 1)} autoFocus
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-500">
                    {stepIndex! + 1 >= TOUR_STEPS.length ? 'Entendido' : 'Siguiente'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </TourContext.Provider>
  );
}
