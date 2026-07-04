-- Creación de orden transaccional con código OT correlativo por taller.
--
-- Antes: el frontend leía la última orden, calculaba 'OT-####' sumando 1 e insertaba la orden y sus
-- líneas en llamadas separadas. Dos altas concurrentes producían el MISMO código (work_orders.code
-- no tenía UNIQUE) y, si fallaban las líneas, quedaba una orden huérfana con código saltado.
--
-- Ahora: índice UNIQUE(organization_id, code) como red de seguridad + RPC create_work_order que
-- calcula el correlativo, inserta la orden y todas sus líneas en UNA transacción, con reintento ante
-- colisión. El trigger recalc_work_order_total fija total_amount desde las líneas.
-- Idempotente.

-- Deduplicar códigos OT repetidos (secuela de la carrera previa) antes del índice único:
-- se conserva el más antiguo de cada grupo y se renumera el resto al siguiente correlativo libre.
do $$
declare
  r record;
  v_next int;
begin
  for r in
    select w.id, w.organization_id
      from public.work_orders w
     where w.code is not null
       and exists (
         select 1 from public.work_orders w2
          where w2.organization_id = w.organization_id
            and w2.code = w.code
            and w2.id <> w.id
            and (w2.created_at < w.created_at or (w2.created_at = w.created_at and w2.id < w.id)))
  loop
    select coalesce(max((substring(code from 4))::int), 0) + 1
      into v_next
      from public.work_orders
     where organization_id = r.organization_id and code ~ '^OT-[0-9]+$';
    update public.work_orders set code = 'OT-' || lpad(v_next::text, 4, '0') where id = r.id;
  end loop;
end $$;

-- Correlativo único por taller (parcial: solo cuando hay código).
create unique index if not exists work_orders_org_code_uidx
  on public.work_orders (organization_id, code) where code is not null;

create or replace function public.create_work_order(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_status text,
  p_scheduled_at timestamptz,
  p_notes text,
  p_items jsonb
) returns table(id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_code text;
  v_order_id uuid;
  v_next int;
  v_attempts int := 0;
begin
  if v_org is null then
    raise exception 'sin taller activo' using errcode = '42501';
  end if;
  -- DEFINER bypasea RLS: re-aplicar el gate operacional (aprobado/activo/al día) a mano.
  if not public.org_is_operational(v_org) and not public.is_super_admin() then
    raise exception 'el taller no está operativo' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.organization_id = v_org) then
    raise exception 'cliente inválido' using errcode = '42501';
  end if;
  if p_vehicle_id is not null
     and not exists (select 1 from public.vehicles ve where ve.id = p_vehicle_id and ve.organization_id = v_org) then
    raise exception 'vehículo inválido' using errcode = '42501';
  end if;

  -- Correlativo por taller, con reintento si otra alta concurrente toma el mismo código.
  loop
    v_attempts := v_attempts + 1;
    select coalesce(max((substring(w.code from 4))::int), 0) + 1
      into v_next
      from public.work_orders w
     where w.organization_id = v_org and w.code ~ '^OT-[0-9]+$';
    v_code := 'OT-' || lpad(v_next::text, 4, '0');
    begin
      insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, scheduled_at, notes)
        values (v_org, p_customer_id, p_vehicle_id, v_code, coalesce(p_status, 'pending'), p_scheduled_at, p_notes)
        returning work_orders.id into v_order_id;
      exit;
    exception when unique_violation then
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;

  -- Líneas (el trigger recalc_work_order_total fija total_amount).
  insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
  select v_order_id,
         nullif(it->>'service_id', '')::uuid,
         coalesce(nullif(it->>'description', ''), 'Servicio'),
         coalesce((it->>'quantity')::int, 1),
         coalesce((it->>'unit_price')::int, 0),
         coalesce((it->>'quantity')::int, 1) * coalesce((it->>'unit_price')::int, 0)
    from jsonb_array_elements(p_items) as it;

  return query select v_order_id, v_code;
end $$;

grant execute on function public.create_work_order(uuid, uuid, text, timestamptz, text, jsonb) to authenticated;
