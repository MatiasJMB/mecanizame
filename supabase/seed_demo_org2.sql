-- Seed del 2º taller (multi-tenant): da métricas al panel Super Admin.
-- Idempotente para la organización "Taller Sur Diésel".
do $$
declare
  v_org uuid; cat uuid; s1 uuid; s2 uuid;
  c1 uuid; c2 uuid; v1 uuid; v2 uuid; o uuid;
begin
  select id into v_org from public.organizations where slug like 'taller-sur-di-sel%' order by created_at limit 1;
  if v_org is null then raise notice 'Taller Sur no encontrado.'; return; end if;

  delete from public.work_orders where organization_id = v_org;
  delete from public.vehicles     where organization_id = v_org;
  delete from public.customers    where organization_id = v_org;
  delete from public.services           where organization_id = v_org;
  delete from public.service_categories where organization_id = v_org;

  insert into public.service_categories (organization_id, name, sort_order)
    values (v_org, 'Reparación y Eliminación', 0) returning id into cat;
  insert into public.services (organization_id, category_id, name, base_price)
    values (v_org, cat, 'Eliminación / Reparación de DPF', 145000) returning id into s1;
  insert into public.services (organization_id, category_id, name, base_price)
    values (v_org, cat, 'Reparación de Turbo', 320000) returning id into s2;

  insert into public.customers (organization_id, full_name, phone) values
    (v_org, 'Rodrigo Fuentes', '+56 9 5544 3322') returning id into c1;
  insert into public.customers (organization_id, full_name, phone) values
    (v_org, 'Camila Rojas', '+56 9 4433 2211') returning id into c2;
  insert into public.vehicles (organization_id, customer_id, license_plate, make, model, year, fuel_type)
    values (v_org, c1, 'PRTX-14', 'Hyundai', 'Porter', 2017, 'Diésel') returning id into v1;
  insert into public.vehicles (organization_id, customer_id, license_plate, make, model, year, fuel_type)
    values (v_org, c2, 'SLMN-77', 'Mitsubishi', 'L200', 2020, 'Diésel') returning id into v2;

  insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, total_amount, created_at)
    values (v_org, c1, v1, 'OT-0001', 'completed', 145000, date_trunc('month', now()) + interval '5 days') returning id into o;
  insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
    values (o, s1, 'Eliminación de DPF', 1, 145000, 145000);

  insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, total_amount, created_at)
    values (v_org, c2, v2, 'OT-0002', 'completed', 320000, now() - interval '25 days') returning id into o;
  insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
    values (o, s2, 'Reparación de turbo', 1, 320000, 320000);

  insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, total_amount, created_at)
    values (v_org, c1, v1, 'OT-0003', 'pending', 145000, now() - interval '1 day');

  raise notice 'Taller Sur sembrado: 2 clientes, 2 vehículos, 3 órdenes.';
end $$;
