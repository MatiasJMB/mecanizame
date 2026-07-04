// Acceso a datos de órdenes de trabajo.
import { supabase } from './client';

/** Línea de una orden nueva. */
export type NewOrderItem = { service_id: string | null; description: string; quantity: number; unit_price: number };

/** Crea una orden + sus líneas de forma atómica, con código OT correlativo por taller
 *  (RPC transaccional: sin carrera de código ni órdenes huérfanas). Devuelve id y código. */
export async function createWorkOrder(params: {
  customerId: string;
  vehicleId: string | null;
  status: string;
  scheduledAt: string | null;
  notes: string | null;
  items: NewOrderItem[];
}) {
  const { data, error } = await supabase.rpc('create_work_order', {
    p_customer_id: params.customerId,
    p_vehicle_id: params.vehicleId,
    p_status: params.status,
    p_scheduled_at: params.scheduledAt,
    p_notes: params.notes,
    p_items: params.items,
  });
  const row = Array.isArray(data) ? data[0] : data;
  return { data: row as { id: string; code: string } | null, error };
}

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
