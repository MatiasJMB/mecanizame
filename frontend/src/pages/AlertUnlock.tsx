import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Crown, LoaderCircle, Lock, Megaphone, ShieldCheck, Sparkles, CreditCard, ReceiptText, ChevronRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { ALERT_PLAN_COPY, type AlertBillingCycle, type AlertPlanId, formatClp } from '../lib/alertPlans';
import { fetchJson } from '../lib/api';
import { usePageHeader } from '../components/AppLayout';

type AccessState = {
  isAdmin: boolean;
  isUnlocked: boolean;
  bakeryName: string;
  subscriptionStatus: string;
  plan: string;
  billingCycle: string;
  accessUntil: string | null;
  pendingCheckoutId: string | null;
  checkoutStatus: string | null;
};

const SUCCESS_CONFETTI_COLORS = ['#f97316', '#fb923c', '#ffffff', '#eab308', '#facc15'];

function launchConfetti() {
  const end = Date.now() + 5 * 1000;
  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: SUCCESS_CONFETTI_COLORS, zIndex: 10000 });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: SUCCESS_CONFETTI_COLORS, zIndex: 10000 });
    if (Date.now() < end) requestAnimationFrame(frame);
  }());
  setTimeout(() => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: SUCCESS_CONFETTI_COLORS, ticks: 200, gravity: 1.2, scalar: 1.2, shapes: ['star'], zIndex: 10000 });
  }, 500);
}

export default function AlertUnlock() {
  const {
    bakeryId,
    bakeryName,
    session,
    isAdmin,
    isAlertUnlocked,
    alertAccessUntil,
    alertBillingCycle,
    refreshBakery,
  } = useAuth();
  const navigate = useNavigate();

  const [billingCycle, setBillingCycle] = useState<AlertBillingCycle>((alertBillingCycle as AlertBillingCycle) || 'monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<AlertPlanId | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isRedirectingToCheckout, setIsRedirectingToCheckout] = useState(false);
  const [error, setError] = useState('');
  const [accessState, setAccessState] = useState<AccessState | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    document.title = 'AhoraPan - ALERTA PAN';
  }, []);

  useEffect(() => {
    const loadAccess = async () => {
      if (!bakeryId || !session?.access_token) {
        setIsCheckingAccess(false);
        return;
      }

      try {
        const data = await fetchJson<{ access: AccessState }>(`/api/alerta-pan/access-status?bakery_id=${bakeryId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        setAccessState(data.access);
        if (data.access?.plan === 'plus' || data.access?.plan === 'pro') {
          // No seleccionamos automáticamente para no disparar el checkout summary
        }
        if (data.access?.billingCycle === 'monthly' || data.access?.billingCycle === 'yearly') {
          setBillingCycle(data.access.billingCycle);
        }
        await refreshBakery();
      } catch (err: any) {
        // Sin backend disponible (p. ej. en desarrollo) el estado por defecto es
        // "no activado"; no mostramos un error de red intrusivo al usuario.
        console.warn('No se pudo cargar el estado de ALERTA PAN:', err?.message || err);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    loadAccess();
  }, [bakeryId, session?.access_token]);

  useEffect(() => {
    if (searchParams.get('payment_success') === 'true' && accessState?.isUnlocked) {
      launchConfetti();
      setShowSuccessModal(true);
      setTourStep(0);

      const newParams = new URLSearchParams(searchParams);
      newParams.delete('payment_success');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, accessState, setSearchParams]);

  const handleConfirmCheckout = async () => {
    if (!bakeryId || !session?.access_token || !selectedPlanId) return;

    setIsRedirectingToCheckout(true);
    setError('');

    try {
      const data = await fetchJson<{ bypassed?: boolean; checkoutUrl?: string }>('/api/alerta-pan/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bakery_id: bakeryId,
          plan: selectedPlanId,
          billing_cycle: billingCycle,
        }),
      });

      if (data.bypassed) {
        await refreshBakery();
        setAccessState(prev => prev ? { ...prev, isAdmin: true, isUnlocked: true } : null);
        return;
      }

      if (!data.checkoutUrl) {
        throw new Error('SumUp no devolvio una URL de pago');
      }

      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setError(err.message || 'No se pudo abrir SumUp');
      setIsRedirectingToCheckout(false);
    }
  };

  const handleSimulateSuccess = async () => {
    if (!selectedPlanId) return;
    // Best-effort: si el backend está disponible, persiste la activación.
    try {
      if (bakeryId && session?.access_token) {
        await fetchJson('/api/alerta-pan/simulate-success', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ bakery_id: bakeryId, plan: selectedPlanId, billing_cycle: billingCycle }),
        });
        await refreshBakery();
      }
    } catch {
      // Sin backend (desarrollo): seguimos con una simulación puramente frontend.
    }
    // Mostramos el flujo de éxito / agradecimiento de inmediato (sin recargar).
    setAccessState((prev) => ({
      isAdmin: prev?.isAdmin ?? true,
      isUnlocked: true,
      bakeryName: prev?.bakeryName || bakeryName || 'tu panadería',
      subscriptionStatus: 'active',
      plan: selectedPlanId,
      billingCycle: prev?.billingCycle || billingCycle,
      accessUntil: prev?.accessUntil ?? null,
      pendingCheckoutId: null,
      checkoutStatus: 'PAID',
    }));
    launchConfetti();
    setShowSuccessModal(true);
    setTourStep(0);
  };

  const handleStartPremiumTour = () => {
    sessionStorage.setItem('alert-pan-tour-pending', '1');
    setShowSuccessModal(false);
    setTourStep(0);
    navigate('/');
  };



  const hasUnlockedAccess = isAlertUnlocked || accessState?.isUnlocked;
  const accessUntil = accessState?.accessUntil || alertAccessUntil;
  
  // Cálculos de Checkout
  const selectedPlanData = selectedPlanId ? ALERT_PLAN_COPY[selectedPlanId] : null;
  const basePrice = selectedPlanData ? (billingCycle === 'monthly' ? selectedPlanData.monthlyPrice : selectedPlanData.yearlyPrice) : 0;
  const netPrice = Math.round(basePrice / 1.19);
  const ivaPrice = basePrice - netPrice;
  const serviceFee = Math.round(basePrice * 0.03);
  const finalTotal = basePrice + serviceFee;
  const valueProps = [
    'Avisa cuando el pan acaba de salir',
    'Reduce merma y pedidos olvidados',
    'Mantiene clientes activos por WhatsApp',
  ];

  // Título + estado en la ÚNICA barra superior (sin cabecera propia duplicada).
  usePageHeader(
    {
      title: (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-500">
            <Megaphone className="h-4 w-4" />
          </span>
          <h1 className="truncate text-lg font-black tracking-tight text-theme-base md:text-xl">Alerta Pan</h1>
        </div>
      ),
      actions: (
        <span
          className={`hidden rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] sm:inline-block ${hasUnlockedAccess ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : 'border-amber-500/30 bg-amber-500/10 text-amber-600'}`}
        >
          {hasUnlockedAccess ? 'Servicio activo' : 'Elige un plan'}
        </span>
      ),
    },
    [hasUnlockedAccess],
  );

  return (
    <div className="iphone-liquid-page-safe min-h-screen bg-theme-base text-theme-base selection:bg-orange-500/30">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-8 md:py-10">

        <div className="grid gap-8 lg:grid-cols-[1fr,380px]">
          
          {/* Main Content */}
          <main className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-left-6 duration-700 delay-150">
            <section className="isolate relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] border border-orange-500/15 bg-gray-900/60 p-6 md:p-10 shadow-xl backdrop-blur-2xl transform-gpu [mask-image:linear-gradient(white,white)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] bg-clip-padding">
              <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-orange-500/[0.08] blur-[80px] pointer-events-none"></div>
              
              <div className="relative mb-10">
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-orange-300">
                  <Sparkles className="h-3 w-3" />
                  Venta asistida por WhatsApp
                </p>
                <h1 className="max-w-3xl text-3xl font-black leading-[1.1] tracking-tight text-white md:text-6xl">
                  Activa avisos premium para vender el pan en su mejor momento.
                </h1>
                <p className="mt-4 md:mt-6 max-w-2xl text-sm leading-relaxed text-gray-400 md:text-lg">
                  ALERTA PAN ayuda a avisar cuando hay produccion lista, recordar retiros y mantener a tus clientes cerca sin depender de publicaciones manuales o mensajes improvisados.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {valueProps.map((item) => (
                    <div key={item} className="rounded-2xl border border-orange-500/10 bg-orange-500/5 px-4 py-3 text-[11px] font-bold leading-snug text-gray-400">
                      <CheckCircle2 className="mb-2 h-4 w-4 text-orange-500" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggle Billing */}
              <div className="mb-10 inline-flex items-center gap-2 rounded-2xl border border-orange-500/15 bg-gray-950/40 p-1.5">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-[0.18em] transition-all duration-300 ${billingCycle === 'monthly' ? 'bg-orange-500 text-white shadow-lg shadow-orange-950/40' : 'text-gray-400 hover:bg-orange-500/10 hover:text-orange-300'}`}
                >
                  Pago mensual
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`relative rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-[0.18em] transition-all duration-300 ${billingCycle === 'yearly' ? 'bg-orange-500 text-white shadow-lg shadow-orange-950/40' : 'text-gray-400 hover:bg-orange-500/10 hover:text-orange-300'}`}
                >
                  Pago anual
                  <span className="absolute -top-2 -right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[8px] font-black text-emerald-950">Mejor valor</span>
                </button>
              </div>

              {/* Plan Cards */}
              <div className="grid gap-6 xl:grid-cols-2">
                {(Object.entries(ALERT_PLAN_COPY) as [AlertPlanId, typeof ALERT_PLAN_COPY[AlertPlanId]][]).map(([planId, plan]) => {
                  const isSelected = selectedPlanId === planId;
                  const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;

                  return (
                    <button
                      key={planId}
                      onClick={() => setSelectedPlanId(planId)}
                      className={`group relative flex flex-col text-left overflow-hidden rounded-[2rem] border p-6 md:p-8 shadow-lg transition-all duration-150 [mask-image:linear-gradient(white,white)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] bg-clip-padding ${isSelected ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30 shadow-[0_0_40px_rgba(249,115,22,0.12)]' : 'border-orange-500/10 bg-gray-900/60 hover:border-orange-500/30 hover:-translate-y-0.5'}`}
                    >
                      <div className="mb-6 flex items-start justify-between">
                        <div>
                          <p className={`text-[10px] font-black uppercase tracking-[0.25em] transition-colors duration-150 ${isSelected ? 'text-orange-400' : 'text-gray-500 group-hover:text-orange-300'}`}>{plan.badge}</p>
                          <h2 className={`mt-2 text-3xl font-black tracking-tight transition-colors ${isSelected ? 'text-orange-50' : 'text-white group-hover:text-orange-50'}`}>{plan.name}</h2>
                          <p className={`mt-3 max-w-sm text-xs leading-relaxed transition-colors ${isSelected ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300'}`}>{plan.description}</p>
                        </div>
                        <div className={`rounded-2xl border p-3 transition-all duration-150 ${isSelected ? 'border-orange-400/40 bg-orange-400/20 text-orange-300' : 'border-orange-500/10 bg-gray-950/40 text-gray-500 group-hover:border-orange-500/30 group-hover:bg-orange-500/10 group-hover:text-orange-300'}`}>
                          {planId === 'pro' ? <Crown className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
                        </div>
                      </div>

                      <div className="mb-6">
                        {billingCycle === 'monthly' ? (
                          <div className="space-y-1">
                            <div className="relative flex items-baseline gap-2">
                              <span className="absolute -top-3 left-0 font-bold text-orange-500">*</span>
                              <span className={`text-4xl font-black tracking-tighter transition-colors ${isSelected ? 'text-orange-50' : 'text-white group-hover:text-orange-50'}`}>{formatClp(price)}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${isSelected ? 'text-orange-300' : 'text-gray-500 group-hover:text-orange-300'}`}>/mes</span>
                            </div>
                            <p className={`text-[9px] italic transition-colors ${isSelected ? 'text-gray-400' : 'text-gray-500/80 group-hover:text-gray-400'}`}>Precio del plan. El resumen incluye IVA y tarifa operativa antes de pagar.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <div className="relative flex items-baseline gap-2">
                                <span className="absolute -top-3 left-0 font-bold text-orange-500">*</span>
                                <span className={`text-4xl font-black tracking-tighter transition-colors ${isSelected ? 'text-orange-50' : 'text-white group-hover:text-orange-50'}`}>{formatClp(Math.round(price / 12))}</span>
                                <span className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${isSelected ? 'text-orange-300' : 'text-gray-500 group-hover:text-orange-300'}`}>/mes</span>
                              </div>
                              <p className={`text-[9px] italic transition-colors ${isSelected ? 'text-gray-400' : 'text-gray-500/80 group-hover:text-gray-400'}`}>Valor equivalente mensual. El pago anual se realiza una sola vez.</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                              <Sparkles className="h-3 w-3" />
                              Pago anual: {formatClp(price)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto space-y-4">
                        {plan.features.map((feature) => (
                          <div key={feature} className={`flex items-start gap-3 text-sm leading-tight transition-colors ${isSelected ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300'}`}>
                            <Check className={`mt-0.5 h-4 w-4 shrink-0 transition-colors ${isSelected ? 'text-orange-400' : 'text-emerald-500/70'}`} />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      {isSelected && (
                        <div className="absolute top-4 right-4 animate-in zoom-in duration-300">
                          <CheckCircle2 className="h-6 w-6 text-orange-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </main>

          {/* Sidebar / Checkout Summary */}
          <aside className="space-y-6 animate-in fade-in slide-in-from-right-6 duration-700 delay-300">
            
            {/* Status Card */}
            <div className="rounded-[2.5rem] border border-orange-500/15 bg-gray-900/60 p-8 shadow-lg backdrop-blur-2xl">
              <div className="flex items-center justify-between mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-300">Estado de ALERTA PAN</p>
                {isCheckingAccess && <LoaderCircle className="h-4 w-4 animate-spin text-orange-500" />}
              </div>

              <div className="flex items-center gap-4">
                <div className={`rounded-2xl p-4 transition-colors duration-500 ${hasUnlockedAccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-900/30 text-gray-400'}`}>
                  {hasUnlockedAccess ? <ShieldCheck className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
                </div>
                <div>
                  <p className="text-xl font-black text-white">{hasUnlockedAccess ? 'Funcion activa' : 'Aun sin activar'}</p>
                  <p className="text-xs leading-relaxed text-gray-500">
                    {isAdmin ? 'Acceso administrativo habilitado.' : accessUntil ? `Vence el ${new Date(accessUntil).toLocaleDateString('es-CL')}` : 'Selecciona un plan para habilitar el envio de avisos.'}
                  </p>
                </div>
              </div>

              {!hasUnlockedAccess && (
                <div className="mt-8 space-y-4">
                  <div className="rounded-2xl border border-orange-500/10 bg-orange-500/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60 mb-2">Por que activarlo</p>
                    <p className="text-xs leading-relaxed text-gray-400">Convierte el momento de salida del horno en una notificacion clara para tus clientes. Ideal para mover stock fresco y ordenar mejor los retiros.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Checkout Panel */}
            {selectedPlanId ? (
              <div className="sticky top-20 rounded-[2rem] md:rounded-[2.5rem] border border-orange-500/30 bg-gray-900/60 p-6 md:p-8 shadow-xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-8 duration-500 [mask-image:linear-gradient(white,white)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] bg-clip-padding">
                <div className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-white">Resumen de activacion</h3>
                    <p className="text-xs text-gray-500">Pago unico manual, sin renovacion automatica</p>
                  </div>
                  <ReceiptText className="h-6 w-6 text-orange-500" />
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Plan seleccionado</span>
                    <span className="font-bold text-white uppercase tracking-wider">{selectedPlanData?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ciclo</span>
                    <span className="text-white">{billingCycle === 'monthly' ? 'Mensual' : 'Anual'}</span>
                  </div>
                  <div className="h-[1px] w-full bg-gray-900/30 my-2"></div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Neto</span>
                    <span className="text-white">{formatClp(netPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">IVA (19%)</span>
                    <span className="text-white">{formatClp(ivaPrice)}</span>
                  </div>
                  <div className="h-[1px] w-full bg-gray-900/30 my-2"></div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-300">Subtotal</span>
                    <span className="text-white">{formatClp(basePrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Tarifa operativa SumUp (3%)</span>
                    <span className="text-white">{formatClp(serviceFee)}</span>
                  </div>
                  <div className="h-[1px] w-full bg-gray-900/40 my-4"></div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-lg font-black text-white">Total</span>
                    <span className="text-3xl font-black text-orange-500">{formatClp(finalTotal)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedPlanId === 'pro' && (
                    <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-500">
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Sparkles className="h-3 w-3" /> Beneficio PRO
                      </p>
                      <p className="text-[10px] leading-relaxed text-gray-400">
                        Despues del pago, escribenos a <span className="text-white font-bold">ahorapansupport@gmail.com</span> para activar el posicionamiento destacado y revisar los datos publicos de tu local.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleConfirmCheckout}
                    disabled={isRedirectingToCheckout}
                    className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-orange-500 px-6 py-5 text-xs font-black uppercase tracking-[0.25em] text-white transition-all hover:bg-orange-400 active:scale-[0.98] disabled:opacity-70"
                  >
                    {isRedirectingToCheckout ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Pagar con SumUp
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-gray-900/30 p-4 text-[10px] leading-relaxed text-gray-400">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                    <p>
                      <span className="block font-bold text-white mb-0.5">Sin cobros automaticos</span>
                      El acceso se activa por periodos pagados. No guardamos tu tarjeta para cobros recurrentes; tu decides cuando renovar.
                    </p>
                  </div>
                  <p className="flex items-center justify-center gap-2 text-[10px] text-gray-500">
                    <CreditCard className="h-3 w-3" />
                    Pago seguro procesado por SumUp
                  </p>

                  {isAdmin && (
                    <div className="pt-4 mt-4 border-t border-white/5">
                      <button
                        onClick={handleSimulateSuccess}
                        className="w-full border border-orange-500/30 bg-orange-500/5 py-4 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] text-orange-400 hover:bg-orange-500/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="h-3 w-3" />
                        Modo Desarrollador: Simular Éxito
                      </button>
                      <p className="mt-2 text-[8px] text-gray-600 text-center uppercase tracking-widest">Solo visible en Localhost</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[2.5rem] border border-dashed border-orange-500/20 bg-gray-900/30 p-10 text-center">
                <CreditCard className="mx-auto mb-4 h-10 w-10 text-gray-700" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Selecciona un plan para ver precio final e iniciar pago</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-xs text-red-400 animate-in shake duration-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </aside>
        </div>

        {/* Footer info */}
        <footer className="mt-16 border-t border-white/5 pt-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
            © 2026 AhoraPan Platform · Todos los derechos reservados
          </p>
        </footer>
      </div>

      {/* Success Modal / Feature Tour */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="relative my-4 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-orange-500/30 bg-[var(--theme-card)] shadow-[0_0_90px_rgba(249,115,22,0.26)] animate-in zoom-in-95 duration-700 sm:rounded-[2.5rem] md:rounded-[3rem]">
            {/* Animaciones de fondo */}
            <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-orange-500/20 blur-[90px] animate-pulse"></div>
            <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-[90px] animate-pulse"></div>
            
            <div className="relative p-5 sm:p-7 md:p-12 lg:p-14">
              <div className="mb-5 flex justify-center md:mb-8">
                <div className="relative">
                  <div className="absolute inset-0 scale-150 bg-orange-500/20 blur-2xl rounded-full"></div>
                  <div className="relative rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 p-4 shadow-2xl shadow-orange-500/40 transform-gpu transition-transform duration-500 hover:scale-105 md:rounded-3xl md:p-5">
                    <Sparkles className="h-9 w-9 text-white md:h-14 md:w-14" />
                  </div>
                </div>
              </div>

              {tourStep === 0 && (
                <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <p className="mb-3 text-[10px] md:text-xs font-black uppercase tracking-[0.32em] text-orange-400">¡Gracias por tu compra!</p>
                  <h2 className="mb-4 text-3xl font-black leading-tight tracking-tight text-white md:mb-5 md:text-5xl lg:text-6xl">
                    Alerta Pan ya está <span className="text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">activa</span>
                  </h2>
                  <p className="mx-auto mb-6 max-w-xl px-1 text-sm font-medium leading-relaxed text-gray-300 md:mb-8 md:text-lg">
                    Gracias por confiar en nosotros. <span className="text-white font-bold">{accessState?.bakeryName}</span> ya cuenta con el plan <span className="text-orange-500 font-black uppercase tracking-widest">{accessState?.plan}</span> para avisar producción fresca y ordenar mejor los retiros.
                  </p>
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={() => setTourStep(1)}
                      className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-[1.25rem] bg-orange-500 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_20px_40px_-10px_rgba(249,115,22,0.35)] transition-all hover:bg-orange-400 active:scale-95 sm:text-sm md:rounded-[1.75rem] md:px-10 md:py-5"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/10 to-orange-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      Cómo aprovecharlo
                      <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
                    </button>
                    <p className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest font-black">Dos ajustes rápidos para empezar bien</p>
                  </div>
                </div>
              )}

              {tourStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-12 duration-700">
                  <div className="mb-5 flex items-start gap-3 md:mb-7 md:gap-5">
                    <div className="shrink-0 rounded-2xl bg-orange-500/15 p-3 md:p-4 border border-orange-500/30">
                      <Megaphone className="h-6 w-6 md:h-8 md:w-8 text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl md:text-3xl font-black text-white tracking-tight">Avisos de pan listo</h3>
                      <p className="text-orange-400 text-[10px] font-black uppercase tracking-widest">Paso 1 de 2</p>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-5 md:mb-7">
                    Usa <span className="text-white font-black">ALERTA PAN</span> cuando tengas produccion fresca, promociones del dia o stock que quieras mover rapido.
                  </p>
                  <div className="rounded-[1.25rem] md:rounded-[1.75rem] border border-orange-500/10 bg-gray-900/30 p-4 md:p-5 mb-6 md:mb-8 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-orange-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                    <p className="relative text-xs md:text-sm text-orange-200/80 italic leading-relaxed">
                      Consejo: envia mensajes cortos, claros y solo cuando exista disponibilidad real. Eso cuida la confianza de tus clientes.
                    </p>
                  </div>
                  <button
                    onClick={() => setTourStep(2)}
                    className="w-full bg-orange-500 text-white py-4 md:py-5 rounded-[1.25rem] md:rounded-[1.75rem] text-xs md:text-sm font-black uppercase tracking-[0.18em] transition-all hover:bg-orange-400 hover:shadow-[0_15px_30px_-5px_rgba(249,115,22,0.4)] active:scale-95"
                  >
                    Siguiente: retiros
                  </button>
                </div>
              )}

              {tourStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-12 duration-700">
                  <div className="mb-5 flex items-start gap-3 md:mb-7 md:gap-5">
                    <div className="shrink-0 rounded-2xl bg-emerald-500/15 p-3 md:p-4 border border-emerald-500/30">
                      <CheckCircle2 className="h-6 w-6 md:h-8 md:w-8 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl md:text-3xl font-black text-white tracking-tight">Recordatorios de retiro</h3>
                      <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Paso 2 de 2</p>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-5 md:mb-7">
                    El bot puede ayudar a recordar el retiro de pedidos, reduciendo olvidos, tiempos muertos y productos que pierden frescura.
                  </p>
                  <div className="rounded-[1.25rem] md:rounded-[1.75rem] border border-orange-500/10 bg-gray-900/30 p-5 md:p-6 mb-6 md:mb-8 text-center">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Siguiente paso:</p>
                    <p className="text-xs md:text-sm text-gray-300 leading-relaxed px-2">
                      Revisa tus tiempos maximos de retiro en <span className="text-orange-500 font-bold uppercase">Mi Perfil</span> para que los avisos calcen con tu operacion.
                    </p>
                  </div>
                  <button
                    onClick={handleStartPremiumTour}
                    className="group relative w-full overflow-hidden rounded-[1.25rem] bg-gradient-to-r from-orange-500 to-orange-600 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:shadow-[0_20px_40px_-10px_rgba(249,115,22,0.5)] active:scale-95 md:rounded-[1.75rem] md:py-5 md:text-sm"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                    ENTRAR AL PANEL
                  </button>
                </div>
              )}

              <div className="mt-6 md:mt-8 flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${tourStep === i ? 'w-8 bg-orange-500' : 'w-2 bg-gray-900/40'}`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
