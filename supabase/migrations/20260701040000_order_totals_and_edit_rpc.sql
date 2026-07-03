-- Total de la orden autoritativo en BD + guardado atómico de la edición de órdenes.
-- 1) Trigger: work_orders.total_amount se recalcula solo desde sus líneas.
-- 2) RPC save_order_edit: edita líneas + datos de la orden en una sola transacción.

-- ----------------------------------------------------------------------------
-- 1. Recalcular total al cambiar líneas
-- ----------------------------------------------------------------------------
create or replace function public.recalc_work_order_total()
returns trigger language plpgsql set search_path = public as $$
declare
  v_order_id uuid;
begin
  if tg_op = 'DELETE' then
    v_order_id := old.work_order_id;
  else
    v_order_id := new.work_order_id;
  end if;

  update public.work_orders
     set total_amount = coalesce((select sum(subtotal) from public.work_order_items where work_order_id = v_order_id), 0)
   where id = v_order_id;

  -- Si una línea cambió de orden (no ocurre en la app, pero por completitud), recalcular la anterior.
  if tg_op = 'UPDATE' and old.work_order_id is distinct from new.work_order_id then
    update public.work_orders
       set total_amount = coalesce((select sum(subtotal) from public.work_order_items where work_order_id = old.work_order_id), 0)
     where id = old.work_order_id;
  end if;

  return null;
end $$;

drop trigger if exists trg_work_order_items_total on public.work_order_items;
create trigger trg_work_order_items_total
  after insert or update or delete on public.work_order_items
  for each row execute function public.recalc_work_order_total();

-- Sincroniza los totales existentes con sus líneas (por si había desvíos).
update public.work_orders wo
   set total_amount = coalesce((select sum(i.subtotal) from public.work_order_items i where i.work_order_id = wo.id), 0);

-- ----------------------------------------------------------------------------
-- 2. Guardado atómico de la edición de una orden (security invoker: RLS aplica)
-- ----------------------------------------------------------------------------
create or replace function public.save_order_edit(
  p_order_id     uuid,
  p_scheduled_at timestamptz,
  p_notes        text,
  p_items        jsonb
) returns void
language plpgsql set search_path = public as $$
declare
  it jsonb;
begin
  -- Líneas quitadas en la edición
  delete from public.work_order_items
   where work_order_id = p_order_id
     and id not in (
       select (i->>'id')::uuid
         from jsonb_array_elements(p_items) i
        where i->>'id' is not null
     );

  -- Líneas existentes (update) y nuevas (insert)
  for it in select * from jsonb_array_elements(p_items) loop
    if it->>'id' is not null then
      update public.work_order_items
         set description = coalesce(nullif(it->>'description', ''), 'Servicio'),
             quantity    = coalesce((it->>'quantity')::int, 1),
             unit_price  = coalesce((it->>'unit_price')::int, 0),
             subtotal    = coalesce((it->>'quantity')::int, 1) * coalesce((it->>'unit_price')::int, 0),
             service_id  = nullif(it->>'service_id', '')::uuid
       where id = (it->>'id')::uuid and work_order_id = p_order_id;
    else
      insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
      values (
        p_order_id,
        nullif(it->>'service_id', '')::uuid,
        coalesce(nullif(it->>'description', ''), 'Servicio'),
        coalesce((it->>'quantity')::int, 1),
        coalesce((it->>'unit_price')::int, 0),
        coalesce((it->>'quantity')::int, 1) * coalesce((it->>'unit_price')::int, 0)
      );
    end if;
  end loop;

  -- Datos de la orden (el trigger ya dejó el total correcto)
  update public.work_orders
     set scheduled_at = p_scheduled_at,
         notes        = p_notes
   where id = p_order_id;

  -- Si la orden no existe o no es visible bajo RLS, nada se tocó: abortar todo.
  if not found then
    raise exception 'work order % not found or not accessible', p_order_id;
  end if;
end $$;
