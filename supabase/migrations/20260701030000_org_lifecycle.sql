-- ============================================================================
-- Mecanízame · Ciclo de vida del taller (habilitar/deshabilitar/eliminar)
-- - organizations a realtime → logout en vivo al deshabilitar
-- - policy de DELETE para super-admin
-- Idempotente.
-- ============================================================================

-- Realtime en organizations (para reaccionar a is_active en vivo)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.organizations;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- Que el DELETE en realtime envíe la fila (para reaccionar a la eliminación en vivo)
alter table public.organizations replica identity full;

-- El super-admin puede eliminar talleres (hard delete → cascada a datos del taller)
drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
  for delete using (public.is_super_admin());

-- Solo el super-admin puede habilitar/deshabilitar talleres.
-- Se revoca el UPDATE directo (el dueño no puede reactivar su propio taller) y se
-- expone una función controlada.
revoke update on public.organizations from authenticated;

create or replace function public.set_org_active(p_org uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'solo el super-admin puede cambiar el estado de un taller' using errcode = '42501';
  end if;
  update public.organizations set is_active = p_active, updated_at = now() where id = p_org;
end;
$$;
revoke all on function public.set_org_active(uuid, boolean) from public, anon;
grant execute on function public.set_org_active(uuid, boolean) to authenticated;
