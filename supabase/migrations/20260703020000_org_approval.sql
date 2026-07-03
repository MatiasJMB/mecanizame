-- ============================================================================
-- Mecanízame · Aprobación de talleres nuevos (autoservicio)
-- Un taller creado por autoservicio queda PENDIENTE (is_approved=false) y no se
-- puede usar hasta que el super-admin lo aprueba. Evita que un dueño con un
-- taller deshabilitado se cree otro para seguir operando.
-- Los talleres canjeados con código de super-admin (redeem_invitation) quedan
-- aprobados de una vez (ya pasaron por su control). Los talleres existentes se
-- consideran aprobados (default true → backfill).
-- Idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists is_approved boolean not null default true;
comment on column public.organizations.is_approved is
  'false = taller de autoservicio pendiente de aprobación del super-admin. Los existentes y los creados con código quedan true.';

-- create_organization: el taller nuevo queda PENDIENTE y NO cambia el taller activo
-- (el dueño sigue en su taller usable; el nuevo aparece pendiente hasta la aprobación).
create or replace function public.create_organization(p_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_name text;
begin
  if v_uid is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  v_name := nullif(btrim(p_name), '');
  if v_name is null then raise exception 'el nombre del taller es obligatorio' using errcode = '22023'; end if;
  insert into public.organizations (name, slug, phone, is_approved)
  values (v_name,
          public.slugify(v_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
          nullif(btrim(p_phone), ''),
          false)
  returning id into v_org;
  insert into public.memberships (user_id, organization_id, role) values (v_uid, v_org, 'owner');
  return v_org;
end;
$$;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

-- Aprobar un taller pendiente (solo super-admin).
create or replace function public.approve_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'solo el super-admin puede aprobar talleres' using errcode = '42501';
  end if;
  update public.organizations set is_approved = true, updated_at = now() where id = p_org;
end;
$$;
revoke all on function public.approve_org(uuid) from public, anon;
grant execute on function public.approve_org(uuid) to authenticated;

-- Listar talleres pendientes con: dueño que lo creó y si ese dueño YA tiene otro
-- taller deshabilitado o suspendido por pago (señal de intento de sorteo).
create or replace function public.list_pending_orgs()
returns table(org_id uuid, name text, created_at timestamptz, owner_id uuid, owner_email text, creator_has_blocked_org boolean)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.created_at, ow.user_id, p.email,
    coalesce((
      select exists (
        select 1 from public.memberships m2
        join public.organizations o2 on o2.id = m2.organization_id
        where m2.user_id = ow.user_id and o2.id <> o.id
          and (o2.is_active = false
               or (o2.paid_until is not null and o2.paid_until + interval '3 days' < current_date))
      )
    ), false) as creator_has_blocked_org
  from public.organizations o
  left join lateral (
    select m.user_id from public.memberships m
    where m.organization_id = o.id and m.role = 'owner'
    order by m.created_at limit 1
  ) ow on true
  left join public.profiles p on p.id = ow.user_id
  where o.is_approved = false and public.is_super_admin()
  order by o.created_at;
$$;
revoke all on function public.list_pending_orgs() from public, anon;
grant execute on function public.list_pending_orgs() to authenticated;
