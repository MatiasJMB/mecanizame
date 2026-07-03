// Capa de acceso a datos. Punto de entrada único: las páginas/componentes importan
// desde `@/api` en vez de armar llamadas crudas a supabase.rpc/from por su cuenta.
//
// Nota: las lecturas simples de tablas (supabase.from) aún viven en las páginas; esta
// capa concentra hoy las RPCs (el contrato del backend), que era lo más disperso.
export { supabase } from './client';
export * from './organizations';
export * from './members';
export * from './invitations';
export * from './orders';
