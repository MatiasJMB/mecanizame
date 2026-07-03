-- ============================================================================
-- Mecanízame · Seed abundante para el taller ARGUIZONA (demo@taller.cl)
-- Genera muchos clientes/vehículos/órdenes en ~6 meses para simular un flujo
-- de ventas real (Finanzas y Resumen se ven llenos). Idempotente (reescribe).
-- Ejecutar: docker exec -i supabase_db_taller-saas psql -U postgres < seed_demo_rich.sql
-- ============================================================================
do $$
declare
  v_org uuid; v_cust uuid; v_veh uuid; v_order uuid;
  v_sids uuid[]; v_prices int[]; v_snames text[];
  v_names  text[] := array['Juan Pérez','María González','Pedro Soto','Carla Muñoz','Luis Rojas','Ana Torres','Diego Fuentes','Camila Reyes','Jorge Vega','Patricia Díaz','Roberto Silva','Fernanda Castro','Andrés Morales','Valentina Núñez'];
  v_makes  text[] := array['Toyota','Nissan','Ford','Chevrolet','Mitsubishi','Hyundai','Volkswagen','Mazda','Isuzu','Peugeot','Renault','Fiat','Mercedes-Benz','Kia'];
  v_models text[] := array['Hilux','Navara','Ranger','D-Max','L200','Porter','Amarok','BT-50','D-Max','Partner','Kangoo','Ducato','Sprinter','Frontier'];
  v_alpha  text := 'BCDFGHJKLPRSTVWXYZ';
  v_vids uuid[] := '{}'; v_vcust uuid[] := '{}';
  i int; j int; k int; s int; nveh int; nsvc int;
  v_created timestamptz; v_status text; v_total int; v_price int; v_sid uuid; v_plate text;
begin
  select id into v_org from public.organizations where slug like 'taller-demo-diesel%' order by created_at limit 1;
  if v_org is null then raise notice 'ARGUIZONA no encontrado.'; return; end if;

  delete from public.work_orders where organization_id = v_org;
  delete from public.vehicles     where organization_id = v_org;
  delete from public.customers    where organization_id = v_org;

  -- Servicios con precios de venta realistas (usa el precio del catálogo si > 0)
  select array_agg(id), array_agg(name),
         array_agg(case when base_price > 0 then base_price
                        when name ilike '%turbo%'    then 350000
                        when name ilike '%inyector%' then 220000
                        when name ilike '%scanner%'  then 45000
                        when name ilike '%adblue%'   then 120000
                        else 150000 end)
    into v_sids, v_snames, v_prices
    from public.services where organization_id = v_org and deleted_at is null;
  if v_sids is null then raise notice 'Sin servicios; corre seed_demo.sql primero.'; return; end if;

  -- Clientes + vehículos
  for i in 1..array_length(v_names, 1) loop
    insert into public.customers (organization_id, full_name, phone)
    values (v_org, v_names[i], '+56 9 ' || (5000 + floor(random() * 4999))::int || ' ' || (1000 + floor(random() * 8998))::int)
    returning id into v_cust;
    nveh := 1 + floor(random() * 2)::int;
    for j in 1..nveh loop
      v_plate := substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1) || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1)
              || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1) || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1)
              || '-' || lpad(floor(random() * 99)::int::text, 2, '0');
      k := 1 + floor(random() * array_length(v_makes, 1))::int;
      insert into public.vehicles (organization_id, customer_id, license_plate, make, model, year, fuel_type, mileage)
      values (v_org, v_cust, v_plate, v_makes[k], v_models[k], 2012 + floor(random() * 13)::int, 'Diésel', 40000 + floor(random() * 220000)::int)
      returning id into v_veh;
      v_vids := v_vids || v_veh; v_vcust := v_vcust || v_cust;
    end loop;
  end loop;

  -- Órdenes distribuidas en ~6 meses
  for i in 1..80 loop
    k := 1 + floor(random() * array_length(v_vids, 1))::int;
    v_veh := v_vids[k]; v_cust := v_vcust[k];
    v_created := now() - (floor(random() * 178)::int::text || ' days')::interval - (floor(random() * 24)::int::text || ' hours')::interval;
    if v_created < now() - interval '10 days' then
      v_status := case when random() < 0.9 then 'completed' else 'cancelled' end;
    else
      v_status := (array['pending','in_progress','completed'])[1 + floor(random() * 3)::int];
    end if;
    insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, total_amount, created_at)
    values (v_org, v_cust, v_veh, 'OT-' || lpad(i::text, 4, '0'), v_status, 0, v_created)
    returning id into v_order;
    nsvc := 1 + floor(random() * 2)::int; v_total := 0;
    for s in 1..nsvc loop
      k := 1 + floor(random() * array_length(v_sids, 1))::int;
      v_sid := v_sids[k]; v_price := v_prices[k];
      insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
      values (v_order, v_sid, v_snames[k], 1, v_price, v_price);
      v_total := v_total + v_price;
    end loop;
    update public.work_orders set total_amount = v_total where id = v_order;
  end loop;

  -- Garantiza órdenes COMPLETADAS dentro del mes actual (para "ingresos del mes")
  for i in 81..96 loop
    k := 1 + floor(random() * array_length(v_vids, 1))::int;
    v_veh := v_vids[k]; v_cust := v_vcust[k];
    v_created := date_trunc('month', now()) + (random() * (now() - date_trunc('month', now())));
    insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, total_amount, created_at)
    values (v_org, v_cust, v_veh, 'OT-' || lpad(i::text, 4, '0'), 'completed', 0, v_created)
    returning id into v_order;
    nsvc := 1 + floor(random() * 2)::int; v_total := 0;
    for s in 1..nsvc loop
      k := 1 + floor(random() * array_length(v_sids, 1))::int;
      v_sid := v_sids[k]; v_price := v_prices[k];
      insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
      values (v_order, v_sid, v_snames[k], 1, v_price, v_price);
      v_total := v_total + v_price;
    end loop;
    update public.work_orders set total_amount = v_total where id = v_order;
  end loop;

  raise notice 'ARGUIZONA sembrado: % clientes, % vehículos, 96 órdenes.', array_length(v_names, 1), array_length(v_vids, 1);
end $$;
