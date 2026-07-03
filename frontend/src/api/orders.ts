// Acceso a datos de órdenes de trabajo.
import { supabase } from './client';

/** Línea de una orden al editarla (servicio, cantidad y precio). */
export type OrderEditItem = {
  id: string | null;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

/** Guarda la edición de una orden de forma atómica (reemplaza sus líneas y recalcula el total). */
export const saveOrderEdit = (params: {
  orderId: string;
  scheduledAt: string | null;
  notes: string | null;
  items: OrderEditItem[];
}) =>
  supabase.rpc('save_order_edit', {
    p_order_id: params.orderId,
    p_scheduled_at: params.scheduledAt,
    p_notes: params.notes,
    p_items: params.items,
  });
