-- ============================================================================
-- taller-saas · Seed demo (catálogo real del taller de diésel)
-- Basado en el concepto entregado por el dueño:
--   "Humo por el escape, pérdida de potencia entre otras fallas."
--   Reparación/eliminación DPF · EGR · AdBlue (recarga) · Turbos
--   Diagnóstico y calibración de inyectores diésel (laboratorio propio)
--   Scanner y diagnóstico de motor (ECU y sensores)
--   Todo garantizado por 6 meses.
-- Idempotente: reescribe el catálogo de la organización demo.
-- Ejecutar:  docker exec -i supabase_db_taller-saas psql -U postgres < seed_demo.sql
-- ============================================================================

do $$
declare
  v_org        uuid;
  v_cat_elim   uuid;
  v_cat_iny    uuid;
  v_cat_diag   uuid;
begin
  select id into v_org from public.organizations where slug like 'taller-demo-diesel%' order by created_at limit 1;
  if v_org is null then
    raise notice 'Organización demo no encontrada; nada que sembrar.';
    return;
  end if;

  -- Catálogo limpio (idempotencia): borra servicios y categorías previas de la org.
  delete from public.services           where organization_id = v_org;
  delete from public.service_categories where organization_id = v_org;

  -- Categorías
  insert into public.service_categories (organization_id, name, sort_order)
    values (v_org, 'Reparación y Eliminación', 0) returning id into v_cat_elim;
  insert into public.service_categories (organization_id, name, sort_order)
    values (v_org, 'Inyección Diésel — Laboratorio', 1) returning id into v_cat_iny;
  insert into public.service_categories (organization_id, name, sort_order)
    values (v_org, 'Diagnóstico Electrónico', 2) returning id into v_cat_diag;

  -- Servicios (base_price en CLP; 0 = "a cotizar". Precios editables por el taller.)
  insert into public.services (organization_id, category_id, name, description, base_price) values
    (v_org, v_cat_elim, 'Eliminación / Reparación de DPF',
       'Filtro de partículas diésel: humo negro, pérdida de potencia, testigo encendido. Con garantía 6 meses.', 150000),
    (v_org, v_cat_elim, 'Eliminación / Reparación de EGR',
       'Válvula EGR: fallas, humo, mayor consumo. Reparación o eliminación con garantía 6 meses.', 150000),
    (v_org, v_cat_elim, 'AdBlue — Recarga y Reparación (SCR)',
       'Sistema AdBlue/SCR: recarga, fallas de arranque y limitación de potencia. Garantía 6 meses.', 150000),
    (v_org, v_cat_elim, 'Reparación de Turbo',
       'Turbocompresor: pérdida de potencia, humo, ruidos. Diagnóstico y reparación.', 0),
    (v_org, v_cat_iny,  'Diagnóstico y Calibración de Inyectores Diésel',
       'Laboratorio propio. Con y sin extracción en el taller. Prueba y calibración.', 0),
    (v_org, v_cat_diag, 'Scanner y Diagnóstico de Motor (ECU)',
       'Lectura y diagnóstico de ECU, sensores y actuadores del motor.', 0);

  raise notice 'Catálogo demo sembrado para org %', v_org;
end $$;
