-- Aplica el ESTADO del taller (aprobado / activo / al día de pago) en la BD, no solo en el cliente.
--
-- Antes: las policies de tenant solo comprobaban organization_id = current_org_id(); la aprobación,
-- la suspensión del super-admin y la suspensión por impago vivían únicamente en el render de React
-- (SuspendedGate). Un usuario podía llamar set_active_org(orgPendiente) + insert/update desde la
-- consola y operar igual → evasión total de la aprobación y del cobro.
--
-- Ahora: un helper org_is_operational() replica la lógica de lib/billing (gracia = 3 días) y policies
-- RESTRICTIVE por comando bloquean INSERT/UPDATE en las tablas de tenant cuando el taller no está
-- operativo. Se hacen AND con las policies permisivas *_all existentes. SELECT queda libre (ver
-- histórico). El super-admin (incl. impersonación) queda exento.
--
-- Idempotente: create or replace + drop policy if exists.

-- ----------------------------------------------------------------------------
-- Helper: ¿el taller puede operar? (aprobado, activo y dentro del período de gracia de pago)
-- ----------------------------------------------------------------------------
create or replace function public.org_is_operational(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select o.is_approved
            and o.is_active
            and (o.paid_until is null or o.paid_until + interval '3 days' >= current_date)
       from public.organizations o
      where o.id = p_org),
    false);
$$;

grant execute on function public.org_is_operational(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Policies RESTRICTIVE de INSERT/UPDATE en cada tabla de tenant con organization_id
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'customers', 'vehicles', 'service_categories', 'services', 'work_orders',
    'conversations', 'messages', 'social_accounts', 'social_posts', 'bot_sessions'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('drop policy if exists %I on public.%I', t || '_operational_ins', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert
         with check (public.org_is_operational(organization_id) or public.is_super_admin())',
      t || '_operational_ins', t);

    execute format('drop policy if exists %I on public.%I', t || '_operational_upd', t);
    execute format(
      'create policy %I on public.%I as restrictive for update
         using (public.org_is_operational(organization_id) or public.is_super_admin())
         with check (public.org_is_operational(organization_id) or public.is_super_admin())',
      t || '_operational_upd', t);
  end loop;
end $$;

-- work_order_items no tiene organization_id: hereda el estado operativo de su work_order padre.
drop policy if exists work_order_items_operational_ins on public.work_order_items;
create policy work_order_items_operational_ins on public.work_order_items as restrictive for insert
  with check (
    public.is_super_admin() or exists (
      select 1 from public.work_orders wo
       where wo.id = work_order_items.work_order_id
         and public.org_is_operational(wo.organization_id)));

drop policy if exists work_order_items_operational_upd on public.work_order_items;
create policy work_order_items_operational_upd on public.work_order_items as restrictive for update
  using (
    public.is_super_admin() or exists (
      select 1 from public.work_orders wo
       where wo.id = work_order_items.work_order_id
         and public.org_is_operational(wo.organization_id)))
  with check (
    public.is_super_admin() or exists (
      select 1 from public.work_orders wo
       where wo.id = work_order_items.work_order_id
         and public.org_is_operational(wo.organization_id)));
