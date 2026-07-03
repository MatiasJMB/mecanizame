// Ayuda contextual por módulo (mostrada en el botón (i) del encabezado).
// Escrita para que cualquier mecánico o dueño entienda cómo usar cada sección.

export type HelpContent = { title: string; steps: string[] };

export const HELP: Record<string, HelpContent> = {
  resumen: {
    title: '¿Qué es el Resumen?',
    steps: [
      'Vista general del taller: ingresos del mes, clientes, vehículos y órdenes activas.',
      'Haz clic en una tarjeta de KPI para ir directo a esa sección.',
      'Abajo ves las últimas órdenes registradas: haz clic en una para ver su detalle.',
    ],
  },
  clientes: {
    title: 'Cómo usar Clientes',
    steps: [
      'Cada cliente tiene su ficha con vehículos e historial de trabajos por patente.',
      'Crea un cliente con “Nuevo cliente”.',
      'Selecciónalo en la lista para ver su ficha completa a la derecha.',
      'Dentro de la ficha agrega sus vehículos con “Agregar vehículo”.',
      'Haz clic en un trabajo del historial para ver o editar esa orden.',
      'Usa el buscador de arriba para encontrar por nombre, teléfono o patente.',
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
      '“Activas” es lo que está en el taller; “Historial” lo terminado o anulado.',
      'Haz clic en una orden para ver su detalle, cambiar el estado o editarla.',
      'Usa el buscador de arriba para encontrar por cliente, patente o código.',
    ],
  },
  finanzas: {
    title: 'Cómo usar Finanzas',
    steps: [
      'Muestra el rendimiento financiero del taller. Solo cuentan las órdenes “Terminadas”.',
      'Elige un período rápido (este mes, mes pasado, año) o un rango de fechas.',
      'Verás ingresos, trabajos, ticket promedio y lo que tienes “en el taller ahora” por cobrar.',
      'Pasa el mouse por el gráfico para ver el detalle; haz clic en un punto para la lista de trabajos de ese día o mes.',
      'Cambia entre Gráfico y Tabla para ver la evolución de tus ingresos como línea de flujo o como listado por período.',
      '“Exportar CSV” descarga las ventas del período para Excel (útil para tu contador).',
    ],
  },
  admin: {
    title: 'Panel de Administración',
    steps: [
      'Solo visible para el Super Admin (dueño del software).',
      'Si un dueño crea un taller, aparece en “Talleres por aprobar”: apruébalo o recházalo. Se avisa si el dueño ya tiene un taller deshabilitado (posible intento de sortear la suspensión).',
      'Ves todos los talleres aprobados, con sus clientes, vehículos, órdenes e ingresos.',
      'En cada taller, el estado de cobro se calcula solo por fecha: Al día → Por vencer → Vencido → Suspendido.',
      '“Configurar” fija el monto mensual y el próximo vencimiento (guíate por su facturación para el precio); “Registrar pago” suma un mes.',
      'Al taller se le avisa automáticamente antes de vencer; si no paga, tras la gracia su acceso se suspende solo (sin que revises uno por uno).',
    ],
  },
  equipo: {
    title: 'Equipo del taller',
    steps: [
      'Ves los miembros de este taller y sus roles: Dueño, Administrador y Empleado.',
      'Para sumar a alguien, genera una invitación con su rol y comparte el código; lo usa al registrarse o desde “Agregar taller”.',
      'Dueño y Administrador gestionan el equipo; el Empleado hace el trabajo diario pero no elimina registros ni ve Finanzas.',
      'Puedes cambiar el rol de un miembro o quitarlo. El taller siempre debe tener al menos un Dueño.',
      'Con el selector de taller (abajo a la izquierda) cambias entre los talleres a los que perteneces.',
    ],
  },
};
