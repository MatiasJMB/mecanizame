// Tipos de dominio compartidos por toda la app.
// Fuente única de la forma de las entidades del backend (Supabase) para evitar
// redefiniciones sueltas y `any` en las páginas.

import type { Role } from '@/lib/roles';
export type { Role };

/** Un taller (tabla `organizations`). */
export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  plan: string | null;
  logo_url: string | null;
  brand_color: string | null;
  business_hours: unknown;
  is_active: boolean;
  is_approved: boolean;
  paid_until: string | null;
  last_payment_at: string | null;
  monthly_fee: number | null;
};

/** Membresía del usuario en un taller, con su rol. */
export type Membership = { role: Role; organization: Organization };

/** Fila devuelta por la RPC `list_org_members`. */
export type OrgMember = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};

/** Fila devuelta por la RPC `list_pending_orgs` (talleres por aprobar). */
export type PendingOrg = {
  org_id: string;
  name: string;
  created_at: string;
  owner_id: string;
  owner_email: string | null;
  creator_has_blocked_org: boolean;
};

/** Vista previa de una invitación de equipo (RPC `validate_org_invitation`). */
export type OrgInvitationPreview = { org_name: string; role: Role };
