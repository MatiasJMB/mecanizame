-- ============================================================================
-- Mecanízame · Registro por invitación + endurecimiento del super-admin
-- Idempotente (create or replace / drop if exists). No edita el init.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla de invitaciones (claves que genera el super-admin)
-- ----------------------------------------------------------------------------
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  note        text,                                       -- "para quién" / referencia
  created_by  uuid references auth.users(id) on delete set null,
  is_used     boolean not null default false,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz,                                -- null = no expira
  created_at  timestamptz not null default now()
);
create index if not exists idx_invitations_is_used on public.invitations(is_used);

alter table public.invitations enable row level security;

drop policy if exists invitations_super_admin_all on public.invitations;
create policy invitations_super_admin_all on public.invitations
  for all using (public.is_super_admin()) with check (public.is_super_admin());

grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
revoke all on public.invitations from anon;

-- ----------------------------------------------------------------------------
-- 2. generate_invitation: solo super-admin; código legible XXXX-XXXX
-- ----------------------------------------------------------------------------
create or replace function public.generate_invitation(
  p_note       text default null,
  p_expires_at timestamptz default null
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- sin 0/O/1/I/L
  v_code text;
  v_i    int;
  v_try  int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'solo el super-admin puede generar invitaciones' using errcode = '42501';
  end if;

  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);

    begin
      insert into public.invitations (code, note, created_by, expires_at)
      values (v_code, nullif(btrim(p_note), ''), auth.uid(), p_expires_at);
      return v_code;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 10 then raise exception 'no se pudo generar un código único'; end if;
    end;
  end loop;
end;
$$;

revoke all on function public.generate_invitation(text, timestamptz) from public, anon;
grant execute on function public.generate_invitation(text, timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. redeem_invitation: usuario autenticado canjea el código (atómico)
-- ----------------------------------------------------------------------------
create or replace function public.redeem_invitation(
  p_code     text,
  p_org_name text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_inv  public.invitations%rowtype;
  v_org  uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  v_name := nullif(btrim(p_org_name), '');
  if v_name is null then
    raise exception 'el nombre del taller es obligatorio' using errcode = '22023';
  end if;

  p_code := upper(btrim(p_code));

  if exists (select 1 from public.memberships where user_id = v_uid) then
    raise exception 'este usuario ya pertenece a una organización' using errcode = '23505';
  end if;

  -- Bloquea la fila para serializar canjes concurrentes del mismo código.
  select * into v_inv from public.invitations where upper(code) = p_code for update;

  if not found then
    raise exception 'código de invitación inválido' using errcode = 'P0002';
  end if;
  if v_inv.is_used then
    raise exception 'este código ya fue utilizado' using errcode = 'P0001';
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'este código de invitación expiró' using errcode = 'P0001';
  end if;

  insert into public.organizations (name, slug)
  values (v_name, public.slugify(v_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  returning id into v_org;

  insert into public.memberships (user_id, organization_id, role)
  values (v_uid, v_org, 'owner');

  update public.invitations
     set is_used = true, used_by = v_uid, used_at = now()
   where id = v_inv.id;

  return v_org;
end;
$$;

revoke all on function public.redeem_invitation(text, text) from public, anon;
grant execute on function public.redeem_invitation(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. handle_new_user: SOLO crea el profile (nunca org ni super-admin por email)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, is_super_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    false                       -- el super-admin se asigna de forma controlada, no por email
  )
  on conflict (id) do nothing;
  return new;                   -- ya NO crea organization ni membership (gate por invitación)
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Eliminar el fallback que creaba una organización sin invitación
-- ----------------------------------------------------------------------------
drop function if exists public.ensure_org_for_current_user(text);

-- ----------------------------------------------------------------------------
-- 6. Hardening: impedir auto-promoción a super-admin vía UPDATE de profiles
--    (grants a nivel de columna: is_super_admin deja de ser escribible por
--     el rol authenticated; solo el owner/postgres puede tocarlo)
-- ----------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant  update (email, full_name) on public.profiles to authenticated;
revoke insert on public.profiles from authenticated;
grant  insert (id, email, full_name) on public.profiles to authenticated;
