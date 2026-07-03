-- ============================================================================
-- Mecanízame · Facturación / suscripción por taller
-- El estado se calcula por fecha desde paid_until (no requiere cron):
--   al día → por vencer → vencido → suspendido (acceso bloqueado).
-- Solo el super-admin configura el cobro y registra pagos.
-- Idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists paid_until      date,
  add column if not exists last_payment_at timestamptz,
  add column if not exists monthly_fee     integer;

comment on column public.organizations.paid_until      is 'Servicio pagado hasta esta fecha (= próximo vencimiento). null = cobro sin configurar.';
comment on column public.organizations.last_payment_at is 'Momento en que el super-admin registró el último pago.';
comment on column public.organizations.monthly_fee     is 'Mensualidad en CLP. La fija el super-admin y puede variar por taller (según su facturación).';

-- ----------------------------------------------------------------------------
-- Configurar el cobro de un taller: monto mensual + próxima fecha de vencimiento.
-- ----------------------------------------------------------------------------
create or replace function public.set_org_billing(p_org uuid, p_paid_until date, p_monthly_fee integer)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'solo el super-admin puede configurar el cobro' using errcode = '42501';
  end if;
  update public.organizations
     set paid_until  = p_paid_until,
         monthly_fee = p_monthly_fee,
         updated_at  = now()
   where id = p_org;
  if not found then
    raise exception 'taller no encontrado';
  end if;
end;
$$;
revoke all on function public.set_org_billing(uuid, date, integer) from public, anon;
grant execute on function public.set_org_billing(uuid, date, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- Registrar un pago: avanza el vencimiento un mes y sella la fecha del pago.
-- Si el taller estaba vencido, el nuevo mes cuenta desde hoy; si estaba al día,
-- extiende el ciclo desde el vencimiento vigente. Devuelve el nuevo vencimiento.
-- ----------------------------------------------------------------------------
create or replace function public.register_org_payment(p_org uuid)
returns date
language plpgsql security definer set search_path = public as $$
declare
  v_base date;
  v_new  date;
begin
  if not public.is_super_admin() then
    raise exception 'solo el super-admin puede registrar pagos' using errcode = '42501';
  end if;
  select greatest(coalesce(paid_until, current_date), current_date) into v_base
    from public.organizations where id = p_org;
  if not found then
    raise exception 'taller no encontrado';
  end if;
  v_new := (v_base + interval '1 month')::date;
  update public.organizations
     set paid_until      = v_new,
         last_payment_at = now(),
         updated_at      = now()
   where id = p_org;
  return v_new;
end;
$$;
revoke all on function public.register_org_payment(uuid) from public, anon;
grant execute on function public.register_org_payment(uuid) to authenticated;
