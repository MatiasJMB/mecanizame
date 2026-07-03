-- ============================================================================
-- Mecanízame · Multi-taller con roles (relación usuario ↔ taller muchos-a-muchos)
--
-- La tabla `memberships` ya es N:M con rol; esta migración habilita:
--  - "taller activo" seleccionable (profiles.active_org_id) sin romper la RLS
--  - roles owner/admin/staff con permisos reales (staff no elimina)
--  - gestión de equipo (invitar/rol/quitar/salir) por owner/admin
--  - autoservicio: crear talleres adicionales sin código
-- Aditiva e idempotente. Sin drops de datos ni de columnas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A1. Taller activo
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists active_org_id uuid references public.organizations(id) on delete set null;
create index if not exists idx_profiles_active_org on public.profiles(active_org_id);
-- NO se otorga grant de columna sobre active_org_id → 'authenticated' no puede escribirla
-- directamente (el revoke previo de UPDATE en profiles lo cubre). Solo set_active_org (definer) la escribe.

-- Backfill: taller activo = la membresía más antigua de cada usuario (re-ejecutable).
update public.profiles p
   set active_org_id = (select m.organization_id from public.memberships m
                         where m.user_id = p.id order by m.created_at, m.id limit 1)
 where p.active_org_id is null;

-- current_org_id(): devuelve active_org_id SOLO si el usuario es miembro real de ese taller
-- (anti-suplantación); si no, cae a la membresía más antigua (comportamiento histórico).
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.active_org_id
       from public.profiles p
      where p.id = auth.uid()
        and p.active_org_id is not null
        and exists (select 1 from public.memberships m
                     where m.user_id = auth.uid() and m.organization_id = p.active_org_id)),
    (select m.organization_id from public.memberships m
      where m.user_id = auth.uid() order by m.created_at, m.id limit 1)
  );
$$;

-- set_active_org(): valida membresía antes de fijar el taller activo.
create or replace function public.set_active_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  if not exists (select 1 from public.memberships where user_id = auth.uid() and organization_id = p_org) then
    raise exception 'no eres miembro de ese taller' using errcode = '42501';
  end if;
  update public.profiles set active_org_id = p_org where id = auth.uid();
end;
$$;
revoke all on function public.set_active_org(uuid) from public, anon;
grant execute on function public.set_active_org(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- A2. Helpers de rol (SECURITY DEFINER → bypassa RLS, sin recursión). Se dejan
--     ejecutables por public (como current_org_id/is_super_admin) porque se usan
--     dentro de políticas RLS evaluadas por el rol que consulta.
-- ----------------------------------------------------------------------------
create or replace function public.is_member_of(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where user_id = auth.uid() and organization_id = p_org);
$$;

create or replace function public.current_role_in(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships where user_id = auth.uid() and organization_id = p_org;
$$;

create or replace function public.has_org_role(p_org uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                  where user_id = auth.uid() and organization_id = p_org and role = any(p_roles));
$$;

-- ----------------------------------------------------------------------------
-- A3. Lectura para el selector de taller y el equipo
-- ----------------------------------------------------------------------------
-- El usuario puede LEER todas las organizaciones donde es miembro (no solo la activa).
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select
  using (public.is_super_admin() or public.is_member_of(id));

-- Listado de miembros del equipo (owner/admin o super-admin). El guard va en el WHERE
-- porque una función SQL no puede hacer raise; devuelve vacío si no tienes permiso.
create or replace function public.list_org_members(p_org uuid)
returns table(user_id uuid, email text, full_name text, role text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.email, p.full_name, m.role, m.created_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
   where m.organization_id = p_org
     and (public.has_org_role(p_org, array['owner','admin']) or public.is_super_admin())
   order by m.created_at, m.id;
$$;
revoke all on function public.list_org_members(uuid) from public, anon;
grant execute on function public.list_org_members(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- A5. Staff no elimina (forzado en la base de datos)
-- ----------------------------------------------------------------------------
-- Políticas RESTRICTIVAS de DELETE (AND con la permisiva *_all): solo owner/admin/super.
-- Se excluye work_order_items a propósito: save_order_edit (security invoker) borra líneas
-- al editar una orden, algo que staff SÍ debe poder hacer.
do $$
declare t text;
begin
  foreach t in array array[
    'customers','vehicles','services','service_categories','work_orders',
    'conversations','messages','social_accounts','social_posts','bot_sessions'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_no_staff_delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete '
      'using (public.has_org_role(organization_id, array[''owner'',''admin'']) or public.is_super_admin())',
      t || '_no_staff_delete', t);
  end loop;
end $$;

-- Borrado lógico (deleted_at): staff no puede marcar como eliminado clientes/vehículos/servicios.
create or replace function public.forbid_staff_soft_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null
     and public.current_role_in(new.organization_id) = 'staff' then
    raise exception 'un empleado (staff) no puede eliminar registros' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_forbid_staff_soft_delete_customers on public.customers;
create trigger trg_forbid_staff_soft_delete_customers before update on public.customers
  for each row execute function public.forbid_staff_soft_delete();
drop trigger if exists trg_forbid_staff_soft_delete_vehicles on public.vehicles;
create trigger trg_forbid_staff_soft_delete_vehicles before update on public.vehicles
  for each row execute function public.forbid_staff_soft_delete();
drop trigger if exists trg_forbid_staff_soft_delete_services on public.services;
create trigger trg_forbid_staff_soft_delete_services before update on public.services
  for each row execute function public.forbid_staff_soft_delete();

-- ----------------------------------------------------------------------------
-- A6. Gestión de equipo: invitaciones por taller + RPCs de miembros
-- ----------------------------------------------------------------------------
create table if not exists public.org_invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  code             text not null unique,
  email            text,                                                       -- opcional: fija destinatario
  role             text not null default 'staff' check (role in ('admin','staff')),  -- nunca 'owner'
  invited_by       uuid references auth.users(id) on delete set null,
  is_used          boolean not null default false,
  used_by          uuid references auth.users(id) on delete set null,
  used_at          timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_org_invitations_org  on public.org_invitations(organization_id);
create index if not exists idx_org_invitations_code on public.org_invitations(code);

alter table public.org_invitations enable row level security;
drop policy if exists org_invitations_manage on public.org_invitations;
create policy org_invitations_manage on public.org_invitations for all
  using  (public.has_org_role(organization_id, array['owner','admin']) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['owner','admin']) or public.is_super_admin());
grant select, delete on public.org_invitations to authenticated;
revoke all on public.org_invitations from anon;

-- invite_member: genera un código de invitación de equipo. owner invita admin/staff; admin solo staff.
create or replace function public.invite_member(
  p_org uuid, p_email text default null, p_role text default 'staff', p_expires_at timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text; v_i int; v_try int := 0;
begin
  if auth.uid() is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  if p_role not in ('admin','staff') then raise exception 'rol inválido' using errcode = '22023'; end if;
  if not (public.has_org_role(p_org, array['owner','admin']) or public.is_super_admin()) then
    raise exception 'no puedes invitar miembros a este taller' using errcode = '42501';
  end if;
  if p_role = 'admin' and not (public.has_org_role(p_org, array['owner']) or public.is_super_admin()) then
    raise exception 'solo el dueño puede invitar administradores' using errcode = '42501';
  end if;
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
    begin
      insert into public.org_invitations (organization_id, code, email, role, invited_by, expires_at)
      values (p_org, v_code, nullif(btrim(p_email), ''), p_role, auth.uid(), p_expires_at);
      return v_code;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 10 then raise exception 'no se pudo generar un código único'; end if;
    end;
  end loop;
end;
$$;
revoke all on function public.invite_member(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.invite_member(uuid, text, text, timestamptz) to authenticated;

-- validate_org_invitation: pre-visualiza a qué taller y con qué rol se uniría (sin consumir).
create or replace function public.validate_org_invitation(p_code text)
returns table(organization_id uuid, org_name text, role text)
language sql stable security definer set search_path = public as $$
  select i.organization_id, o.name, i.role
    from public.org_invitations i
    join public.organizations o on o.id = i.organization_id
   where upper(i.code) = upper(btrim(p_code))
     and not i.is_used
     and (i.expires_at is null or i.expires_at > now());
$$;
grant execute on function public.validate_org_invitation(text) to anon, authenticated;

-- accept_org_invitation: agrega al usuario actual con el rol DE LA FILA (no del input).
create or replace function public.accept_org_invitation(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_inv public.org_invitations%rowtype; v_email text;
begin
  if v_uid is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  select * into v_inv from public.org_invitations where upper(code) = upper(btrim(p_code)) for update;
  if not found then raise exception 'código de invitación inválido' using errcode = 'P0002'; end if;
  if v_inv.is_used then raise exception 'este código ya fue utilizado' using errcode = 'P0001'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'este código de invitación expiró' using errcode = 'P0001'; end if;
  if v_inv.email is not null then
    select email into v_email from public.profiles where id = v_uid;
    if lower(coalesce(v_email, '')) <> lower(v_inv.email) then
      raise exception 'esta invitación es para otro correo' using errcode = '42501'; end if;
  end if;
  if exists (select 1 from public.memberships where user_id = v_uid and organization_id = v_inv.organization_id) then
    raise exception 'ya eres miembro de este taller' using errcode = '23505';
  end if;
  insert into public.memberships (user_id, organization_id, role)
  values (v_uid, v_inv.organization_id, v_inv.role);
  update public.org_invitations set is_used = true, used_by = v_uid, used_at = now() where id = v_inv.id;
  update public.profiles set active_org_id = v_inv.organization_id where id = v_uid;
  return v_inv.organization_id;
end;
$$;
revoke all on function public.accept_org_invitation(text) from public, anon;
grant execute on function public.accept_org_invitation(text) to authenticated;

-- set_member_role: solo owner concede/quita owner; admin mueve staff↔admin sin tocar owners.
create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_target_role text; v_privileged boolean;
begin
  if p_role not in ('owner','admin','staff') then raise exception 'rol inválido' using errcode = '22023'; end if;
  v_privileged := public.has_org_role(p_org, array['owner']) or public.is_super_admin();
  if not (v_privileged or public.has_org_role(p_org, array['admin'])) then
    raise exception 'no puedes gestionar miembros de este taller' using errcode = '42501';
  end if;
  select role into v_target_role from public.memberships
    where organization_id = p_org and user_id = p_user for update;
  if not found then raise exception 'ese usuario no es miembro del taller' using errcode = 'P0002'; end if;
  -- Solo owner/super puede tocar la propiedad (conceder o quitar owner).
  if (p_role = 'owner' or v_target_role = 'owner') and not v_privileged then
    raise exception 'solo el dueño puede gestionar la propiedad del taller' using errcode = '42501';
  end if;
  -- No degradar al último owner.
  if v_target_role = 'owner' and p_role <> 'owner'
     and (select count(*) from public.memberships where organization_id = p_org and role = 'owner') <= 1 then
    raise exception 'el taller debe tener al menos un dueño' using errcode = 'P0001';
  end if;
  update public.memberships set role = p_role where organization_id = p_org and user_id = p_user;
end;
$$;
revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- remove_member: owner quita a cualquiera (salvo último owner); admin solo staff.
create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_target_role text; v_privileged boolean;
begin
  v_privileged := public.has_org_role(p_org, array['owner']) or public.is_super_admin();
  select role into v_target_role from public.memberships
    where organization_id = p_org and user_id = p_user for update;
  if not found then raise exception 'ese usuario no es miembro del taller' using errcode = 'P0002'; end if;
  if not v_privileged then
    if not public.has_org_role(p_org, array['admin']) then
      raise exception 'no puedes gestionar miembros de este taller' using errcode = '42501';
    end if;
    if v_target_role <> 'staff' then
      raise exception 'un administrador solo puede quitar a empleados (staff)' using errcode = '42501';
    end if;
  end if;
  if v_target_role = 'owner'
     and (select count(*) from public.memberships where organization_id = p_org and role = 'owner') <= 1 then
    raise exception 'el taller debe tener al menos un dueño' using errcode = 'P0001';
  end if;
  delete from public.memberships where organization_id = p_org and user_id = p_user;
  update public.profiles set active_org_id = null where id = p_user and active_org_id = p_org;
end;
$$;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- leave_org: el usuario actual abandona un taller (el último owner no puede).
create or replace function public.leave_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text;
begin
  if v_uid is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  select role into v_role from public.memberships
    where organization_id = p_org and user_id = v_uid for update;
  if not found then raise exception 'no eres miembro de ese taller' using errcode = 'P0002'; end if;
  if v_role = 'owner'
     and (select count(*) from public.memberships where organization_id = p_org and role = 'owner') <= 1 then
    raise exception 'eres el único dueño; transfiere la propiedad o pide eliminar el taller' using errcode = 'P0001';
  end if;
  delete from public.memberships where organization_id = p_org and user_id = v_uid;
  update public.profiles set active_org_id = null where id = v_uid and active_org_id = p_org;
end;
$$;
revoke all on function public.leave_org(uuid) from public, anon;
grant execute on function public.leave_org(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- A7. Autoservicio de talleres + relajar el registro para permitir multi-taller
-- ----------------------------------------------------------------------------
-- create_organization: cualquier usuario autenticado crea un taller nuevo (sin código) y queda owner.
create or replace function public.create_organization(p_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_name text;
begin
  if v_uid is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  v_name := nullif(btrim(p_name), '');
  if v_name is null then raise exception 'el nombre del taller es obligatorio' using errcode = '22023'; end if;
  insert into public.organizations (name, slug, phone)
  values (v_name,
          public.slugify(v_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
          nullif(btrim(p_phone), ''))
  returning id into v_org;
  insert into public.memberships (user_id, organization_id, role) values (v_uid, v_org, 'owner');
  update public.profiles set active_org_id = v_org where id = v_uid;
  return v_org;
end;
$$;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

-- redeem_invitation: se QUITA la guarda de multi-membresía y se fija el taller como activo.
create or replace function public.redeem_invitation(p_code text, p_org_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_inv public.invitations%rowtype; v_org uuid; v_name text;
begin
  if v_uid is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  v_name := nullif(btrim(p_org_name), '');
  if v_name is null then raise exception 'el nombre del taller es obligatorio' using errcode = '22023'; end if;
  p_code := upper(btrim(p_code));
  -- (La guarda "este usuario ya pertenece a una organización" fue eliminada: multi-taller permitido.)
  select * into v_inv from public.invitations where upper(code) = p_code for update;
  if not found then raise exception 'código de invitación inválido' using errcode = 'P0002'; end if;
  if v_inv.is_used then raise exception 'este código ya fue utilizado' using errcode = 'P0001'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'este código de invitación expiró' using errcode = 'P0001'; end if;
  insert into public.organizations (name, slug, phone)
  values (v_name,
          public.slugify(v_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
          nullif(btrim(p_phone), ''))
  returning id into v_org;
  insert into public.memberships (user_id, organization_id, role) values (v_uid, v_org, 'owner');
  update public.invitations set is_used = true, used_by = v_uid, used_at = now() where id = v_inv.id;
  update public.profiles set active_org_id = v_org where id = v_uid;
  return v_org;
end;
$$;
