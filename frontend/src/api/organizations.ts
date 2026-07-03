// Acceso a datos de talleres (organizations) y su facturación.
// Cada función centraliza el nombre de la RPC y la forma de sus argumentos/retorno,
// para que las páginas no repartan strings crudos de RPC por todos lados.
import { supabase } from './client';
import type { PendingOrg } from '@/types';

/** Autoservicio: un usuario autenticado crea un taller nuevo (queda pendiente de aprobación). */
export const createOrganization = (name: string, phone: string | null) =>
  supabase.rpc('create_organization', { p_name: name, p_phone: phone });

/** El dueño elimina su propio taller (solo si está vacío). */
export const deleteOwnOrganization = (orgId: string) =>
  supabase.rpc('delete_own_organization', { p_org: orgId });

/** Super-admin aprueba un taller pendiente. */
export const approveOrg = (orgId: string) =>
  supabase.rpc('approve_org', { p_org: orgId });

/** Super-admin: lista de talleres creados por dueños que esperan aprobación. */
export async function listPendingOrgs() {
  const { data, error } = await supabase.rpc('list_pending_orgs');
  return { data: data as PendingOrg[] | null, error };
}

/** Super-admin habilita/deshabilita un taller. */
export const setOrgActive = (orgId: string, active: boolean) =>
  supabase.rpc('set_org_active', { p_org: orgId, p_active: active });

/** Cambia el taller activo del usuario (multi-taller). Valida membresía server-side. */
export const setActiveOrg = (orgId: string) =>
  supabase.rpc('set_active_org', { p_org: orgId });

/** Super-admin fija el monto mensual y el próximo vencimiento de un taller. */
export const setOrgBilling = (orgId: string, paidUntil: string | null, monthlyFee: number | null) =>
  supabase.rpc('set_org_billing', { p_org: orgId, p_paid_until: paidUntil, p_monthly_fee: monthlyFee });

/** Super-admin registra un pago: suma un mes al vencimiento. Devuelve la nueva fecha `paid_until`. */
export async function registerOrgPayment(orgId: string) {
  const { data, error } = await supabase.rpc('register_org_payment', { p_org: orgId });
  return { data: data as string | null, error };
}
