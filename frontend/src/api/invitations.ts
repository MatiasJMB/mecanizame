// Invitaciones: dos tipos distintos.
//  - De EQUIPO: unirse a un taller existente con un rol (validate/accept_org_invitation).
//  - De PLATAFORMA: clave del super-admin para crear un taller nuevo (validate/redeem_invitation).
import { supabase } from './client';
import type { OrgInvitationPreview } from '@/types';

/** Valida una invitación de equipo y devuelve a qué taller y con qué rol se uniría. */
export async function validateOrgInvitation(code: string) {
  const { data, error } = await supabase.rpc('validate_org_invitation', { p_code: code });
  return { data: data as OrgInvitationPreview[] | null, error };
}

/** Acepta una invitación de equipo (crea la membresía con el rol de la invitación). */
export const acceptOrgInvitation = (code: string) =>
  supabase.rpc('accept_org_invitation', { p_code: code });

/** Valida una clave de plataforma (registro de un taller nuevo). Devuelve si es válida. */
export async function validatePlatformInvitation(code: string) {
  const { data, error } = await supabase.rpc('validate_invitation', { p_code: code });
  return { data: data as boolean | null, error };
}

/** Canjea la clave de plataforma creando el taller del nuevo dueño. */
export const redeemInvitation = (code: string, orgName: string, phone: string | null) =>
  supabase.rpc('redeem_invitation', { p_code: code, p_org_name: orgName, p_phone: phone });

/** Super-admin genera una clave de plataforma (un solo uso). Devuelve el código. */
export async function generatePlatformInvitation(note: string | null) {
  const { data, error } = await supabase.rpc('generate_invitation', { p_note: note });
  return { data: data as string | null, error };
}
