// Ayuda contextual por módulo (mostrada en el botón (i) del encabezado).
// Escrita para que cualquier mecánico o dueño entienda cómo usar cada sección.

export type HelpContent = { title: string; steps: string[] };

export const HELP: Record<string, HelpContent> = {
  resumen: {
    title: '¿Qué es el Resumen?',
    steps: [
      'Vista general del taller: ingresos del mes, clientes, vehículos y órdenes activas.',
      'Haz clic en una tarjeta de KPI para ir directo a esa sección.',
      '“Órdenes por estado” muestra cuánto trabajo tienes pendiente, en proceso y terminado.',
      'Abajo ves las últimas órdenes registradas.',
    ],
  },
  clientes: {
    title: 'Cómo usar Clientes',
    steps: [
      'Cada cliente tiene su ficha con vehículos e historial de servicios por patente.',
      'Crea un cliente con “Nuevo cliente”.',
      'Selecciónalo en la lista para ver su ficha 360 a la derecha.',
      'Dentro de la ficha agrega sus vehículos con “Agregar vehículo”.',
      'Busca por nombre, teléfono o patente en el buscador.',
    ],
  },
  servicios: {
    title: 'Cómo usar Servicios',
    steps: [
      'Es el catálogo de trabajos que ofrece el taller, agrupado por categoría.',
      'Crea servicios con “Nuevo servicio” o carga el catálogo base de diésel.',
      'Edita el precio cuando quieras (precio 0 se muestra como “A cotizar”).',
      'Desactiva un servicio para que no aparezca al crear nuevas órdenes.',
    ],
  },
  ordenes: {
    title: 'Cómo usar Órdenes',
    steps: [
      'Son los trabajos del taller. Cada orden liga un cliente, su vehículo y los servicios.',
      'Crea una con “Nueva orden”: elige cliente → vehículo → servicios → fecha.',
      'El total se calcula solo con los servicios que agregas.',
      'Filtra por estado con las pestañas y cámbialo en cada orden.',
    ],
  },
  finanzas: {
    title: 'Cómo usar Finanzas',
    steps: [
      'Muestra el rendimiento financiero del taller.',
      'Elige un período rápido (este mes, mes pasado, año) o un rango de fechas.',
      'Verás ingresos, cantidad de trabajos y ticket promedio del período.',
      'El gráfico muestra los ingresos mes a mes. Solo cuentan las órdenes “Completadas”.',
    ],
  },
  admin: {
    title: 'Panel de Administración',
    steps: [
      'Solo visible para el Super Admin (dueño del software).',
      'Ves todos los talleres registrados en la plataforma.',
      'Cada tarjeta muestra clientes, vehículos, órdenes e ingresos de ese taller.',
      'Arriba, el resumen consolidado de toda la plataforma.',
    ],
  },
};
