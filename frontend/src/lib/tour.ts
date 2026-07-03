// Pasos del tour de bienvenida (hermano de help.ts).
// Cada paso apunta a un elemento con data-tour="<id>"; id vacío = tarjeta centrada.

export type TourStep = {
  id: string;         // valor de data-tour del ancla ('' = paso centrado, sin ancla)
  route?: string;     // ruta a la que navegar antes de mostrar el paso
  title: string;
  body: string;
  optional?: boolean; // si el ancla no aparece (p. ej. página sin ese elemento), el paso se salta
};

// Subir la versión fuerza a que el tour se muestre de nuevo tras un rediseño grande.
export const TOUR_VERSION = 1;
export const tourStorageKey = (userId: string) => `mecanizame-tour-v${TOUR_VERSION}:${userId}`;

export const TOUR_STEPS: TourStep[] = [
  {
    id: '',
    title: '¡Bienvenido a Mecanízame!',
    body: 'Aquí manejas tu taller en 3 pasos: armas tu catálogo de servicios, registras clientes con sus vehículos y creas órdenes de trabajo. Te lo mostramos en 1 minuto.',
  },
  {
    id: 'nav',
    title: 'Las secciones',
    body: 'El menú está ordenado como el flujo del taller: primero armas tu catálogo de Servicios, luego registras Clientes con sus vehículos y les creas Órdenes de trabajo. Finanzas queda aparte, para el análisis.',
  },
  {
    id: 'nuevo-servicio', route: '/servicios',
    title: 'Tu catálogo de trabajos',
    body: 'Aquí viven los trabajos que ofreces con su precio (DPF, EGR, AdBlue…). Si está vacío, puedes cargar el catálogo diésel base con un clic.',
  },
  {
    id: 'nuevo-cliente', route: '/clientes',
    title: 'Tus clientes y sus vehículos',
    body: 'Registra a cada cliente con su patente. Así queda el historial de cada vehículo, como una ficha médica del auto.',
  },
  {
    id: 'nueva-orden', route: '/ordenes',
    title: 'Las órdenes de trabajo',
    body: 'Cada trabajo que entra al taller es una orden: cliente → vehículo → servicios. El total se calcula solo.',
  },
  {
    id: 'filtros-ordenes', route: '/ordenes', optional: true,
    title: 'Activas e Historial',
    body: '“Activas” es lo que está en el taller ahora; “Historial” lo ya terminado o anulado. Haz clic en cualquier orden para ver su detalle, cambiar el estado o editarla.',
  },
  {
    id: 'buscador-global', route: '/ordenes', optional: true,
    title: 'Busca lo que sea',
    body: 'Escribe un nombre, una patente o un código de orden y lo encuentras al tiro. Atajo: la tecla “/”.',
  },
  {
    id: 'kpis', route: '/',
    title: 'Tu resumen',
    body: 'Cada orden Terminada suma a tus ingresos. En Finanzas ves el detalle por período, con el gráfico de ingresos y el ticket promedio.',
  },
  {
    id: 'ayuda',
    title: '¿Dudas después?',
    body: 'Este botón repite el tour cuando quieras. Además, cada sección tiene un botón (i) con instrucciones cortas.',
  },
];
