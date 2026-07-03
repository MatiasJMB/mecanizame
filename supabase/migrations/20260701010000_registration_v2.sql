-- ============================================================================
-- Mecanízame · Registro en un paso (validar clave antes de crear la cuenta)
-- + teléfono del taller. Idempotente.
-- ============================================================================

-- Teléfono de contacto del taller (se pide en el registro)
alter table public.organizations add column if not exists phone text;

-- Pre-validación de la clave SIN consumirla (anon, para bloquear el signup si no es válida).
-- Devuelve solo boolean → no filtra datos de la invitación.
create or replace function public.validate_invitation(p_code text)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.invitations
     where upper(code) = upper(btrim(p_code))
       and not is_used
       and (expires_at is null or expires_at > now())
  );
$$;
revoke all on function public.validate_invitation(text) from public;
grant execute on function public.validate_invitation(text) to anon, authenticated;

-- redeem ahora acepta teléfono (reemplaza la versión de 2 args)
drop function if exists public.redeem_invitation(text, text);
create or replace function public.redeem_invitation(p_code text, p_org_name text, p_phone text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_inv  public.invitations%rowtype;
  v_org  uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  v_name := nullif(btrim(p_org_name), '');
  if v_name is null then raise exception 'el nombre del taller es obligatorio' using errcode = '22023'; end if;
  p_code := upper(btrim(p_code));

  if exists (select 1 from public.memberships where user_id = v_uid) then
    raise exception 'este usuario ya pertenece a una organización' using errcode = '23505';
  end if;

  select * into v_inv from public.invitations where upper(code) = p_code for update;
  if not found then raise exception 'código de invitación inválido' using errcode = 'P0002'; end if;
  if v_inv.is_used then raise exception 'este código ya fue utilizado' using errcode = 'P0001'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then raise exception 'este código de invitación expiró' using errcode = 'P0001'; end if;

  insert into public.organizations (name, slug, phone)
  values (v_name, public.slugify(v_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), nullif(btrim(p_phone), ''))
  returning id into v_org;

  insert into public.memberships (user_id, organization_id, role) values (v_uid, v_org, 'owner');
  update public.invitations set is_used = true, used_by = v_uid, used_at = now() where id = v_inv.id;
  return v_org;
end;
$$;
revoke all on function public.redeem_invitation(text, text, text) from public, anon;
grant execute on function public.redeem_invitation(text, text, text) to authenticated;
