// Roles de un miembro dentro de un taller (memberships.role).
// Fuente única del gating de UI por rol. La restricción real vive en la BD (RLS/RPCs);
// esto es para mostrar/ocultar acciones coherentemente.

export type Role = 'owner' | 'admin' | 'staff';

export const roleLabel: Record<Role, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  staff: 'Empleado',
};

// Chips de estado ya definidos en index.css.
export const roleChip: Record<Role, string> = {
  owner: 'chip-done',      // verde
  admin: 'chip-progress',  // azul
  staff: 'chip-cancel',    // gris
};

export const canManageTeam = (r: Role | null) => r === 'owner' || r === 'admin';
export const canDelete = (r: Role | null) => r === 'owner' || r === 'admin';
export const canSeeFinanzas = (r: Role | null) => r === 'owner' || r === 'admin';
export const canGrantOwner = (r: Role | null) => r === 'owner';
