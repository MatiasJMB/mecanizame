// Constantes de dominio del taller (marca, estados, catálogo base).

export const BRAND = {
  name: 'Taller Mecánico',
  shortName: 'Taller Mecánico',
  tagline: 'Humo por el escape y pérdida de potencia: lo solucionamos.',
  warranty: 'Todo garantizado por 6 meses.',
};

// Estados de la orden de servicio (coinciden con el CHECK del esquema).
export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export const ORDER_STATUS: Record<WorkOrderStatus, { label: string; color: string; dot: string }> = {
  pending:     { label: 'Pendiente',  color: 'text-amber-300 bg-amber-500/10 border-amber-500/20',    dot: 'bg-amber-400' },
  in_progress: { label: 'En proceso', color: 'text-blue-300 bg-blue-500/10 border-blue-500/20',       dot: 'bg-blue-400' },
  completed:   { label: 'Completada', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  cancelled:   { label: 'Cancelada',  color: 'text-gray-400 bg-white/5 border-white/10',              dot: 'bg-gray-500' },
};

export const ORDER_STATUS_ORDER: WorkOrderStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

// Catálogo base de diésel: permite a un taller nuevo cargar el catálogo con 1 clic.
// (Refleja el seed de la organización demo.)
export const DEFAULT_CATALOG: { category: string; services: { name: string; description: string; base_price: number }[] }[] = [
  {
    category: 'Reparación y Eliminación',
    services: [
      { name: 'Eliminación / Reparación de DPF', description: 'Filtro de partículas diésel: humo negro, pérdida de potencia, testigo encendido. Garantía 6 meses.', base_price: 150000 },
      { name: 'Eliminación / Reparación de EGR', description: 'Válvula EGR: fallas, humo, mayor consumo. Reparación o eliminación con garantía 6 meses.', base_price: 150000 },
      { name: 'AdBlue — Recarga y Reparación (SCR)', description: 'Sistema AdBlue/SCR: recarga, fallas de arranque y limitación de potencia. Garantía 6 meses.', base_price: 150000 },
      { name: 'Reparación de Turbo', description: 'Turbocompresor: pérdida de potencia, humo, ruidos. Diagnóstico y reparación.', base_price: 0 },
    ],
  },
  {
    category: 'Inyección Diésel — Laboratorio',
    services: [
      { name: 'Diagnóstico y Calibración de Inyectores Diésel', description: 'Laboratorio propio. Con y sin extracción en el taller. Prueba y calibración.', base_price: 0 },
    ],
  },
  {
    category: 'Diagnóstico Electrónico',
    services: [
      { name: 'Scanner y Diagnóstico de Motor (ECU)', description: 'Lectura y diagnóstico de ECU, sensores y actuadores del motor.', base_price: 0 },
    ],
  },
];
