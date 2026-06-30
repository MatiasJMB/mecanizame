import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Megaphone, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ALERT_TOUR_STORAGE_KEY = 'alert-pan-tour-pending';

type TourStep = {
  title: string;
  desc: string;
  path: string;
  selector?: string;
  icon: ReactNode;
  position: 'top' | 'bottom' | 'center';
};

export default function AlertActivationTour() {
  const { bakeryId, isAlertUnlocked, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const retryRef = useRef<any>(null);
  const shouldRun = Boolean(bakeryId) && (isAdmin || isAlertUnlocked) && sessionStorage.getItem(ALERT_TOUR_STORAGE_KEY) === '1';

  const steps = useMemo<TourStep[]>(() => [
    {
      title: 'Boton de Alerta',
      desc: 'Usa este boton para avisar por WhatsApp cuando tengas pan recien salido, promociones del dia o stock listo para vender.',
      path: '/',
      selector: '[data-tour="broadcast-btn"]',
      icon: <Megaphone className="h-7 w-7 text-emerald-400 md:h-8 md:w-8" />,
      position: 'bottom',
    },
    {
      title: 'Configura tus avisos',
      desc: 'Activa recordatorios para que tus clientes retiren a tiempo y tu operacion mantenga mejor ritmo durante el dia.',
      path: '/perfil',
      selector: '[data-tour="warning-settings"]',
      icon: <Bell className="h-7 w-7 text-amber-300 md:h-8 md:w-8" />,
      position: 'top',
    },
    {
      title: 'Gestion de tu plan',
      desc: 'Revisa el plan contratado, vigencia y estado de ALERTA PAN sin perder el control de tu suscripcion.',
      path: '/perfil',
      selector: '[data-tour="alert-subscription-card"]',
      icon: <CreditCard className="h-7 w-7 text-orange-400 md:h-8 md:w-8" />,
      position: 'bottom',
    },
    {
      title: 'Todo listo',
      desc: 'Tus funciones premium quedaron activas. Usalas en horarios de alta venta para mover stock fresco con mas precision.',
      path: '/',
      icon: <CheckCircle2 className="h-9 w-9 text-emerald-400 md:h-10 md:w-10" />,
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
    if (!shouldRun) return;

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
  }, [location.pathname, navigate, shouldRun, step, steps, locateTarget]);

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

  const finishTour = () => {
    sessionStorage.removeItem(ALERT_TOUR_STORAGE_KEY);
    setIsVisible(false);
    setTargetRect(null);
    setStep(0);
    navigate('/');
  };

  const nextStep = () => {
    if (step >= steps.length - 1) {
      finishTour();
      return;
    }
    setIsVisible(false);
    setTargetRect(null);
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (step === 0) return;
    setIsVisible(false);
    setTargetRect(null);
    setStep((prev) => prev - 1);
  };

  if (!shouldRun || !isVisible) return null;

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

    const cardHeight = Math.min(window.innerHeight * 0.72, 430);
    const cardWidth = Math.min(window.innerWidth - 32, 400);
    const halfCard = cardWidth / 2;
    const centerX = targetRect.left + targetRect.width / 2;
    const left = Math.max(halfCard + 12, Math.min(window.innerWidth - halfCard - 12, centerX));
    const spaceAbove = targetRect.top;
    const spaceBelow = window.innerHeight - targetRect.bottom;
    let showAtTop = current.position === 'top';
    if (showAtTop && spaceAbove < cardHeight && spaceBelow > spaceAbove) showAtTop = false;
    if (!showAtTop && spaceBelow < cardHeight && spaceAbove > spaceBelow) showAtTop = true;
    const top = showAtTop ? targetRect.top - 18 : Math.min(window.innerHeight - 24, targetRect.bottom + 18);

    return {
      left: `${left}px`,
      top: `${top}px`,
      bottom: 'auto',
      transform: `translate(-50%, ${showAtTop ? '-100%' : '0'})`,
    };
  };

  return (
    <div className="fixed inset-0 z-[9998] overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-black/62 backdrop-blur-[4px] pointer-events-auto transition-all duration-500" />

      {targetRect && !isCompact && (
        <div
          className="absolute pointer-events-none rounded-[1.5rem] border-2 border-orange-500/45 shadow-[0_0_30px_rgba(249,115,22,0.38),inset_0_0_15px_rgba(249,115,22,0.18)]"
          style={{
            left: targetRect.left - 10,
            top: targetRect.top - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}

      <div
        className="absolute pointer-events-auto transition-all duration-500"
        style={{
          ...getCardPosition(),
          width: 'min(calc(100vw - 24px), 400px)',
          maxHeight: 'min(78vh, 520px)',
        }}
      >
        <div className="relative flex max-h-[78vh] flex-col overflow-y-auto rounded-[2rem] border border-orange-500/20 bg-[var(--theme-card)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-6 md:rounded-[2.25rem] md:p-8">
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-orange-500/10 blur-[80px]" />

          <button
            onClick={finishTour}
            className="absolute right-4 top-4 z-10 rounded-full border border-orange-500/10 bg-gray-900/30 p-2 text-gray-400 transition-colors hover:bg-orange-500/10 hover:text-orange-300"
            title="Cerrar tour"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-gray-900/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-400 to-orange-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-5 rounded-[1.25rem] border border-orange-500/20 bg-orange-500/10 p-4 shadow-inner">
              {current.icon}
            </div>

            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
              Paso {step + 1} de {steps.length}
            </p>
            <h3 className="mb-3 text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              {current.title}
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-gray-400 md:text-base">
              {current.desc}
            </p>

            <div className="mt-auto flex w-full gap-2 sm:gap-3">
              {step > 0 && (
                <button
                  onClick={prevStep}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-orange-500/10 bg-gray-900/30 py-3 text-xs font-bold text-white transition-all hover:bg-orange-500/10 hover:text-orange-200 active:scale-95 md:py-4 md:text-sm"
                >
                  <ChevronLeft className="h-4 w-4" /> Atras
                </button>
              )}
              <button
                onClick={nextStep}
                className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-orange-600 py-3 text-xs font-black text-white shadow-[0_15px_30px_rgba(234,88,12,0.3)] transition-all hover:bg-orange-500 active:scale-95 md:py-4 md:text-sm"
              >
                {step === steps.length - 1 ? 'Listo para empezar' : 'Siguiente paso'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
