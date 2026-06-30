import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Flame, Megaphone, Package, Folder, Calendar, Bell, CheckCircle2, X, ChevronLeft, ChevronRight } from 'lucide-react';

type Step = {
  title: string;
  desc: string;
  path: string;
  selector?: string;
  icon: ReactNode;
  position: 'top' | 'bottom' | 'center';
};

export default function OnboardingTour() {
  const { bakeryId, hasSeenTour, setHasSeenTour, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const retryRef = useRef<any>(null);

  const steps = useMemo<Step[]>(() => [
    {
      title: 'Bienvenido a Ahora Pan',
      desc: 'Tu panaderia ya tiene panel digital. Este recorrido te muestra las acciones clave para empezar a vender y ordenar pedidos sin friccion.',
      path: '/',
      icon: <Flame className="h-9 w-9 text-orange-500 md:h-10 md:w-10" />,
      position: 'center',
    },
    {
      title: 'Gestion de pedidos',
      desc: "Aqui apareceran los pedidos de tus clientes. Usa las columnas para pasar de 'Preparando' a 'Listo para retiro'.",
      path: '/',
      selector: '[data-tour="orders-header"]',
      icon: <Flame className="h-7 w-7 text-amber-500 md:h-8 md:w-8" />,
      position: 'bottom',
    },
    {
      title: 'Aviso de pan caliente',
      desc: 'Cuando salga pan del horno, este boton permite enviar un aviso masivo por WhatsApp a tus clientes.',
      path: '/',
      selector: '[data-tour="broadcast-btn"]',
      icon: <Megaphone className="h-7 w-7 text-orange-500 md:h-8 md:w-8" />,
      position: 'bottom',
    },
    {
      title: 'Prepara tu menu',
      desc: 'En Productos configuras lo que tus clientes veran en WhatsApp: categorias claras, precios y disponibilidad.',
      path: '/productos',
      icon: <Package className="h-7 w-7 text-emerald-500 md:h-8 md:w-8" />,
      position: 'center',
    },
    {
      title: 'Paso 1: Categorias',
      desc: "Crea secciones como 'Panes', 'Dulces' o 'Bebidas'. Las categorias hacen que tu menu sea mas facil de recorrer.",
      path: '/productos',
      selector: '[data-tour="categories-toggle"]',
      icon: <Folder className="h-7 w-7 text-orange-400 md:h-8 md:w-8" />,
      position: 'bottom',
    },
    {
      title: 'Paso 2: Productos',
      desc: 'Agrega productos con nombre, precio y tipo de venta. Mientras mas claro el catalogo, mas rapido compra el cliente.',
      path: '/productos',
      selector: '[data-tour="add-product-toggle"]',
      icon: <Package className="h-7 w-7 text-emerald-500 md:h-8 md:w-8" />,
      position: 'bottom',
    },
    {
      title: 'Tus horarios',
      desc: 'Define cuando el bot puede recibir pedidos para evitar solicitudes fuera del horario real de tu local.',
      path: '/horarios',
      selector: '[data-tour="business-hours"]',
      icon: <Calendar className="h-7 w-7 text-orange-300 md:h-8 md:w-8" />,
      position: 'bottom',
    },
    {
      title: 'Proteccion de ventas',
      desc: 'Activa recordatorios automaticos para que tus clientes retiren a tiempo y tus productos mantengan frescura.',
      path: '/perfil',
      selector: '[data-tour="warning-settings"]',
      icon: <Bell className="h-7 w-7 text-orange-500 md:h-8 md:w-8" />,
      position: 'bottom',
    },
    {
      title: 'Todo listo',
      desc: 'Ya conoces lo esencial. Tu panaderia queda lista para operar con un flujo mas claro, rapido y profesional.',
      path: '/',
      icon: <CheckCircle2 className="h-10 w-10 text-emerald-500 md:h-12 md:w-12" />,
      position: 'center',
    },
  ], []);

  const locateTarget = useCallback(() => {
    const currentStep = steps[step];
    if (!currentStep) return;

    if (!currentStep.selector) {
      setTargetRect(null);
      setIsVisible(true);
      return;
    }

    const el = document.querySelector(currentStep.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        setIsVisible(true);
        if (rect.top < 96 || rect.bottom > window.innerHeight - 96) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [step, steps]);

  useEffect(() => {
    if (hasSeenTour || isAdmin || !bakeryId) return;

    const currentStep = steps[step];
    if (!currentStep) return;

    if (location.pathname !== currentStep.path) {
      setIsVisible(false);
      setTargetRect(null);
      navigate(currentStep.path);
      return;
    }

    const initialDelay = setTimeout(() => {
      locateTarget();
      retryRef.current = setInterval(locateTarget, 600);
    }, 350);

    return () => {
      clearTimeout(initialDelay);
      if (retryRef.current) clearInterval(retryRef.current);
    };
  }, [step, location.pathname, hasSeenTour, isAdmin, bakeryId, locateTarget, navigate, steps]);

  useEffect(() => {
    if (!isVisible || !targetRect) return;
    const handler = () => locateTarget();
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler, { passive: true });
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [isVisible, targetRect, locateTarget]);

  const finishTour = async () => {
    setIsVisible(false);
    try {
      if (bakeryId) {
        await supabase.from('bakeries').update({ has_seen_tour: true }).eq('id', bakeryId);
      }
    } catch (err) {
      console.warn('No se pudo guardar el progreso del tour en la DB:', err);
    }
    setHasSeenTour(true);
    navigate('/');
  };

  const nextStep = () => {
    if (step < steps.length - 1) {
      setIsVisible(false);
      setTargetRect(null);
      setStep((prev) => prev + 1);
    } else {
      finishTour();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setIsVisible(false);
      setTargetRect(null);
      setStep((prev) => prev - 1);
    }
  };

  if (hasSeenTour || isAdmin || !bakeryId || !isVisible) return null;

  const current = steps[step];
  const progress = ((step + 1) / steps.length) * 100;
  const isCompact = typeof window !== 'undefined' && window.innerWidth < 640;

  const getCardPosition = () => {
    if (!targetRect || current.position === 'center' || isCompact) {
      return {
        left: '50%',
        top: isCompact ? 'auto' : '50%',
        bottom: isCompact ? 'calc(env(safe-area-inset-bottom, 0px) + 14px)' : 'auto',
        transform: isCompact ? 'translateX(-50%)' : 'translate(-50%, -50%)',
      };
    }

    const cardHeight = Math.min(window.innerHeight * 0.72, 410);
    const cardWidth = Math.min(window.innerWidth - 32, 390);
    const halfCard = cardWidth / 2;
    const centerX = targetRect.left + targetRect.width / 2;
    const left = Math.max(halfCard + 12, Math.min(window.innerWidth - halfCard - 12, centerX));
    const spaceAbove = targetRect.top;
    const spaceBelow = window.innerHeight - targetRect.bottom;
    let showBelow = current.position === 'bottom';
    if (showBelow && spaceBelow < cardHeight && spaceAbove > spaceBelow) showBelow = false;
    if (!showBelow && spaceAbove < cardHeight && spaceBelow > spaceAbove) showBelow = true;
    const top = showBelow ? Math.min(window.innerHeight - 24, targetRect.bottom + 18) : targetRect.top - 18;

    return {
      left: `${left}px`,
      top: `${top}px`,
      bottom: 'auto',
      transform: `translate(-50%, ${showBelow ? '0' : '-100%'})`,
    };
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-black/62 backdrop-blur-[4px] pointer-events-auto transition-all duration-500" />

      {targetRect && !isCompact && (
        <div
          className="absolute pointer-events-none rounded-[1.25rem] border-2 border-orange-500/50 shadow-[0_0_24px_rgba(234,88,12,0.34)] transition-all duration-500"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      <div
        className="absolute pointer-events-auto transition-all duration-500"
        style={{
          ...getCardPosition(),
          width: 'min(calc(100vw - 24px), 390px)',
          maxHeight: 'min(78vh, 500px)',
        }}
      >
        <div className="relative max-h-[78vh] overflow-y-auto rounded-[2rem] border border-orange-500/20 bg-[var(--theme-card)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-6 md:rounded-[2.25rem] md:p-8">
          <button
            onClick={finishTour}
            className="absolute right-4 top-4 rounded-full border border-orange-500/10 bg-gray-900/30 p-2 text-gray-400 transition-colors hover:bg-orange-500/10 hover:text-orange-300"
            title="Saltar tutorial"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-[1.25rem] border border-orange-500/20 bg-orange-500/10 p-4 shadow-inner">
              {current.icon}
            </div>

            <h3 className="mb-3 text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              {current.title}
            </h3>

            <p className="mb-5 text-sm leading-relaxed text-gray-400 md:text-base">
              {current.desc}
            </p>

            <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-gray-900/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-400 to-orange-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
              Paso {step + 1} de {steps.length}
            </p>

            <div className="flex w-full gap-2 sm:gap-3">
              {step > 0 && (
                <button
                  onClick={prevStep}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-orange-500/10 bg-gray-900/30 py-3 text-xs font-bold text-white transition-all hover:bg-orange-500/10 hover:text-orange-200 md:text-sm"
                >
                  <ChevronLeft className="h-4 w-4" /> Atras
                </button>
              )}
              <button
                onClick={nextStep}
                className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-orange-600 py-3 text-xs font-black text-white shadow-lg transition-all hover:bg-orange-500 active:scale-95 md:text-sm"
              >
                {step === steps.length - 1 ? (
                  <>Empezar a vender <CheckCircle2 className="ml-1 h-4 w-4" /></>
                ) : (
                  <>Siguiente <ChevronRight className="ml-1 h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
