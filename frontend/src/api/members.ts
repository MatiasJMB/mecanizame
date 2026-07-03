// Acceso a datos del equipo de un taller (memberships) e invitaciones de equipo.
import { supabase } from './client';
import type { OrgMember, Role } from '@/types';

/** Miembros del taller con su rol (RPC definer: solo owner/admin/super-admin). */
export async function listOrgMembers(orgId: string) {
  const { data, error } = await supabase.rpc('list_org_members', { p_org: orgId });
  return { data: data as OrgMember[] | null, error };
}

/** Genera un código de invitación de equipo con un rol. Devuelve el código. */
export async function inviteMember(orgId: string, email: string | null, role: Role) {
  const { data, error } = await supabase.rpc('invite_member', { p_org: orgId, p_email: email, p_role: role });
  return { data: data as string | null, error };
}

/** Cambia el rol de un miembro (respeta la regla de "último dueño"). */
export const setMemberRole = (orgId: string, userId: string, role: Role) =>
  supabase.rpc('set_member_role', { p_org: orgId, p_user: userId, p_role: role });

/** Quita a un miembro del taller. */
export const removeMember = (orgId: string, userId: string) =>
  supabase.rpc('remove_member', { p_org: orgId, p_user: userId });

/** El propio usuario abandona el taller (el último dueño no puede salir). */
export const leaveOrg = (orgId: string) =>
  supabase.rpc('leave_org', { p_org: orgId });
