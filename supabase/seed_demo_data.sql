-- ============================================================================
-- taller-saas · Seed demo (clientes, vehículos y órdenes de servicio)
-- Da contenido creíble a Resumen (KPIs) y Clientes 360.
-- Idempotente: reescribe clientes/vehículos/órdenes de la organización demo.
-- Requiere haber corrido antes seed_demo.sql (catálogo de servicios).
-- Ejecutar: docker exec -i supabase_db_taller-saas psql -U postgres < seed_demo_data.sql
-- ============================================================================

do $$
declare
  v_org uuid;
  c1 uuid; c2 uuid; c3 uuid;
  v1 uuid; v2 uuid; v3 uuid;
  s_dpf uuid; s_egr uuid; s_adblue uuid; s_iny uuid; s_scan uuid;
  o uuid;
begin
  select id into v_org from public.organizations where slug like 'taller-demo-diesel%' order by created_at limit 1;
  if v_org is null then raise notice 'Organización demo no encontrada.'; return; end if;

  delete from public.work_orders where organization_id = v_org;  -- cascada a items
  delete from public.vehicles     where organization_id = v_org;
  delete from public.customers    where organization_id = v_org;

  select id into s_dpf    from public.services where organization_id = v_org and name ilike '%DPF%'        limit 1;
  select id into s_egr    from public.services where organization_id = v_org and name ilike '%EGR%'        limit 1;
  select id into s_adblue from public.services where organization_id = v_org and name ilike '%AdBlue%'     limit 1;
  select id into s_iny    from public.services where organization_id = v_org and name ilike '%Inyectores%' limit 1;
  select id into s_scan   from public.services where organization_id = v_org and name ilike '%Scanner%'    limit 1;

  insert into public.customers (organization_id, full_name, phone, email, notes)
    values (v_org, 'Juan Pérez', '+56 9 8123 4567', 'juan.perez@gmail.com', 'Cliente frecuente. Camioneta de trabajo.') returning id into c1;
  insert into public.customers (organization_id, full_name, phone)
    values (v_org, 'María González', '+56 9 7654 3210') returning id into c2;
  insert into public.customers (organization_id, full_name, phone, notes)
    values (v_org, 'Pedro Soto', '+56 9 6111 2233', 'Flota de 2 camionetas.') returning id into c3;

  insert into public.vehicles (organization_id, customer_id, license_plate, make, model, year, engine, fuel_type, mileage)
    values (v_org, c1, 'GFKL-52', 'Toyota', 'Hilux', 2018, '2.4 D4D', 'Diésel', 145000) returning id into v1;
  insert into public.vehicles (organization_id, customer_id, license_plate, make, model, year, engine, fuel_type, mileage)
    values (v_org, c2, 'HJKL-88', 'Nissan', 'Navara', 2016, '2.5 dCi', 'Diésel', 192000) returning id into v2;
  insert into public.vehicles (organization_id, customer_id, license_plate, make, model, year, engine, fuel_type, mileage)
    values (v_org, c3, 'JKLM-21', 'Ford', 'Ranger', 2019, '3.2 TDCi', 'Diésel', 98000) returning id into v3;
  insert into public.vehicles (organization_id, customer_id, license_plate, make, model, year, engine, fuel_type, mileage)
    values (v_org, c3, 'KLMN-30', 'Chevrolet', 'D-Max', 2015, '2.5 TD', 'Diésel', 210000);

  -- OT-0001 · Juan / Hilux · DPF · completada este mes (cuenta para ingresos del mes)
  insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, total_amount, created_at)
    values (v_org, c1, v1, 'OT-0001', 'completed', 150000, date_trunc('month', now()) + interval '3 days') returning id into o;
  insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
    values (o, s_dpf, 'Eliminación de DPF', 1, 150000, 150000);

  -- OT-0002 · Juan / Hilux · inyectores · en proceso
  insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, total_amount, created_at)
    values (v_org, c1, v1, 'OT-0002', 'in_progress', 180000, now() - interval '2 days') returning id into o;
  insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
    values (o, s_iny, 'Calibración de inyectores (4)', 4, 45000, 180000);

  -- OT-0003 · María / Navara · EGR · completada mes pasado
  insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, total_amount, created_at)
    values (v_org, c2, v2, 'OT-0003', 'completed', 150000, now() - interval '40 days') returning id into o;
  insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal)
    values (o, s_egr, 'Reparación de EGR', 1, 150000, 150000);

  -- OT-0004 · Pedro / Ranger · scanner + AdBlue · pendiente agendada
  insert into public.work_orders (organization_id, customer_id, vehicle_id, code, status, scheduled_at, total_amount, created_at)
    values (v_org, c3, v3, 'OT-0004', 'pending', now() + interval '3 days', 200000, now() - interval '1 day') returning id into o;
  insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, subtotal) values
    (o, s_scan,   'Scanner y diagnóstico', 1, 50000, 50000),
    (o, s_adblue, 'Recarga AdBlue + reparación', 1, 150000, 150000);

  raise notice 'Datos demo sembrados para org %: 3 clientes, 4 vehículos, 4 órdenes.', v_org;
end $$;
