-- ============================================================================
-- Mecanízame · El dueño puede eliminar su PROPIO taller si está vacío.
-- Resuelve el caso "creé un taller por error": el dueño lo limpia solo,
-- sin que el super-admin tenga que vigilar. Un taller con datos operativos
-- (clientes, vehículos u órdenes) NO se puede autoeliminar: eso queda para
-- el super-admin, a propósito, para no perder información por accidente.
-- Idempotente.
-- ============================================================================

create or replace function public.delete_own_organization(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_data int;
begin
  if v_uid is null then raise exception 'no autenticado' using errcode = '28000'; end if;

  -- Solo el dueño (o el super-admin) puede eliminar el taller.
  if not (public.has_org_role(p_org, array['owner']) or public.is_super_admin()) then
    raise exception 'solo el dueño puede eliminar el taller' using errcode = '42501';
  end if;

  -- Debe estar vacío de datos operativos (el super-admin queda exento de esta regla).
  if not public.is_super_admin() then
    select
        (select count(*) from public.customers   where organization_id = p_org and deleted_at is null)
      + (select count(*) from public.vehicles    where organization_id = p_org and deleted_at is null)
      + (select count(*) from public.work_orders where organization_id = p_org)
      into v_data;
    if v_data > 0 then
      raise exception 'este taller ya tiene registros; pide al administrador que lo elimine'
        using errcode = 'P0001';
    end if;
  end if;

  -- La cascada elimina membresías, servicios, categorías, invitaciones, etc.
  delete from public.organizations where id = p_org;
end;
$$;
revoke all on function public.delete_own_organization(uuid) from public, anon;
grant execute on function public.delete_own_organization(uuid) to authenticated;
