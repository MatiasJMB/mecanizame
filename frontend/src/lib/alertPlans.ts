export type AlertPlanId = 'plus' | 'pro';
export type AlertBillingCycle = 'monthly' | 'yearly';

export const ALERT_PLAN_COPY = {
  plus: {
    name: 'Plus',
    badge: 'El esencial',
    description: 'Avisa al instante cuando sale pan del horno y llena tu local en los momentos clave del día.',
    features: [
      'Avisos masivos por WhatsApp a todos tus clientes registrados',
      'Sin límite de clientes en tu base de contactos',
      'Botón de alerta siempre listo en tu panel',
      'Recordatorios automáticos para que retiren a tiempo',
      'Soporte por correo para configurar y resolver dudas',
    ],
    monthlyPrice: 12990,
    yearlyPrice: 119990,
  },
  pro: {
    name: 'Pro',
    badge: 'Más alcance',
    description: 'Todo lo de Plus, más visibilidad destacada y acompañamiento para vender más y desperdiciar menos.',
    features: [
      'Todo lo incluido en el plan Plus',
      'Aparece destacado en las búsquedas del bot',
      'Atención prioritaria para ajustes y soporte',
      'Revisión de estrategia de horarios, mensajes y rotación',
      'Consejos para reducir merma y fidelizar clientes',
      'Acceso anticipado a las nuevas funciones de Alerta Pan',
    ],
    monthlyPrice: 19990,
    yearlyPrice: 189990,
  },
} as const;

export function formatClp(amount: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}
