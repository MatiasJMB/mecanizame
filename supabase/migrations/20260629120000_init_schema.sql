-- ============================================================================
-- taller-saas · Esquema inicial (CRM + marketing para taller automotriz)
-- Multi-tenant: organizations + memberships. RLS por organization_id.
-- Nomenclatura de dominio (NO heredada de "Ahora Pan").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensiones y utilidades
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;          -- gen_random_uuid()

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- slug a partir de texto (para organizations.slug)
create or replace function public.slugify(v text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(v, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- ----------------------------------------------------------------------------
-- 1. Tablas
-- ----------------------------------------------------------------------------

-- Perfil 1:1 con auth.users
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text default '',
  is_super_admin  boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Organización = tenant (un taller)
create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique,
  plan            text not null default 'free',
  logo_url        text,
  brand_color     text default '#2563eb',
  business_hours  jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Membresía usuario ↔ organización (rol)
create table public.memberships (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  role             text not null default 'owner' check (role in ('owner', 'admin', 'staff')),
  created_at       timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- Clientes (org-scoped)
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  full_name        text not null,
  phone            text,
  email            text,
  address          text,
  notes            text,
  tags             text[] default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- Vehículos (núcleo del CRM; historial por patente)
create table public.vehicles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  customer_id      uuid references public.customers(id) on delete set null,
  license_plate    text not null,
  make             text,
  model            text,
  year             int,
  engine           text,
  fuel_type        text,
  mileage          int,
  vin              text,
  color            text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (organization_id, license_plate)
);

-- Categorías de servicio
create table public.service_categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  sort_order       int default 0,
  created_at       timestamptz not null default now()
);

-- Servicios (catálogo: DPF/AdBlue/EGR ...)
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  category_id      uuid references public.service_categories(id) on delete set null,
  name             text not null,
  description      text,
  base_price       int not null default 0,        -- CLP, enteros
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- Órdenes de servicio
create table public.work_orders (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  customer_id      uuid references public.customers(id) on delete set null,
  vehicle_id       uuid references public.vehicles(id) on delete set null,
  code             text,
  status           text not null default 'pending'
                     check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  scheduled_at     timestamptz,
  total_amount     int not null default 0,         -- CLP
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Líneas de la orden
create table public.work_order_items (
  id             uuid primary key default gen_random_uuid(),
  work_order_id  uuid not null references public.work_orders(id) on delete cascade,
  service_id     uuid references public.services(id) on delete set null,
  description    text,
  quantity       int not null default 1,
  unit_price     int not null default 0,           -- CLP
  subtotal       int not null default 0            -- CLP
);

-- Conversaciones (inbox omnicanal)
create table public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  channel              text not null default 'whatsapp'
                         check (channel in ('whatsapp', 'instagram', 'facebook')),
  external_chat_id     text not null,
  customer_id          uuid references public.customers(id) on delete set null,
  vehicle_id           uuid references public.vehicles(id) on delete set null,
  last_message_at      timestamptz,
  last_message_preview text,
  unread_count         int not null default 0,
  status               text not null default 'open' check (status in ('open', 'closed', 'snoozed')),
  assigned_to          uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (organization_id, channel, external_chat_id)
);

-- Mensajes
create table public.messages (
  id                   uuid primary key default gen_random_uuid(),
  conversation_id      uuid not null references public.conversations(id) on delete cascade,
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  direction            text not null check (direction in ('inbound', 'outbound')),
  body                 text,
  media_url            text,
  message_type         text not null default 'text',
  provider_message_id  text,
  status               text not null default 'sent',
  is_automated         boolean not null default false,
  created_at           timestamptz not null default now()
);

-- Cuentas sociales (alojará tokens Meta en Fase 2)
create table public.social_accounts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  platform              text not null,
  external_account_id   text,
  access_token_encrypted text,
  status                text not null default 'disconnected',
  created_at            timestamptz not null default now()
);

-- Publicaciones (compositor RRSS)
create table public.social_posts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  caption          text,
  media_url        text,
  platforms        text[] default '{}',
  scheduled_at     timestamptz,
  status           text not null default 'draft'
                     check (status in ('draft', 'scheduled', 'published', 'failed', 'manual_pending')),
  external_refs    jsonb,
  error_message    text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Sesiones del bot (máquina de estados por chat)
create table public.bot_sessions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  channel          text not null default 'whatsapp',
  external_chat_id text not null,
  state            jsonb not null default '{}'::jsonb,
  context          jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now(),
  unique (organization_id, channel, external_chat_id)
);

-- ----------------------------------------------------------------------------
-- 2. Índices (FKs y organization_id)
-- ----------------------------------------------------------------------------
create index idx_memberships_user            on public.memberships(user_id);
create index idx_memberships_org             on public.memberships(organization_id);
create index idx_customers_org               on public.customers(organization_id);
create index idx_vehicles_org                on public.vehicles(organization_id);
create index idx_vehicles_customer           on public.vehicles(customer_id);
create index idx_service_categories_org      on public.service_categories(organization_id);
create index idx_services_org                on public.services(organization_id);
create index idx_services_category           on public.services(category_id);
create index idx_work_orders_org             on public.work_orders(organization_id);
create index idx_work_orders_customer        on public.work_orders(customer_id);
create index idx_work_orders_vehicle         on public.work_orders(vehicle_id);
create index idx_work_orders_status          on public.work_orders(organization_id, status);
create index idx_work_order_items_wo         on public.work_order_items(work_order_id);
create index idx_work_order_items_service    on public.work_order_items(service_id);
create index idx_conversations_org           on public.conversations(organization_id);
create index idx_conversations_customer      on public.conversations(customer_id);
create index idx_messages_conversation       on public.messages(conversation_id);
create index idx_messages_org                on public.messages(organization_id);
create index idx_social_accounts_org         on public.social_accounts(organization_id);
create index idx_social_posts_org            on public.social_posts(organization_id);
create index idx_bot_sessions_org            on public.bot_sessions(organization_id);

-- ----------------------------------------------------------------------------
-- 3. Triggers updated_at
-- ----------------------------------------------------------------------------
create trigger trg_organizations_updated  before update on public.organizations  for each row execute function public.set_updated_at();
create trigger trg_customers_updated       before update on public.customers       for each row execute function public.set_updated_at();
create trigger trg_vehicles_updated        before update on public.vehicles        for each row execute function public.set_updated_at();
create trigger trg_services_updated        before update on public.services        for each row execute function public.set_updated_at();
create trigger trg_work_orders_updated     before update on public.work_orders     for each row execute function public.set_updated_at();
create trigger trg_social_posts_updated    before update on public.social_posts    for each row execute function public.set_updated_at();
create trigger trg_bot_sessions_updated    before update on public.bot_sessions    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Helpers de seguridad (SECURITY DEFINER → bypassan RLS, evitan recursión)
-- ----------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.memberships
   where user_id = auth.uid()
   order by created_at
   limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

-- Crea org + membership owner para el usuario actual si no existe (fallback de signup)
create or replace function public.ensure_org_for_current_user(p_name text default 'Mi Taller')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'no authenticated user';
  end if;
  select organization_id into v_org from public.memberships where user_id = auth.uid() order by created_at limit 1;
  if v_org is not null then
    return v_org;
  end if;
  insert into public.organizations (name, slug)
  values (p_name, public.slugify(p_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  returning id into v_org;
  insert into public.memberships (user_id, organization_id, role) values (auth.uid(), v_org, 'owner');
  return v_org;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Trigger de signup: crea profile + organization + membership owner
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org   uuid;
  v_name  text;
begin
  insert into public.profiles (id, email, full_name, is_super_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    -- bootstrap del super-admin (silver). Configurable: cambiar este email.
    (new.email = 'sharkfitdevs@gmail.com')
  )
  on conflict (id) do nothing;

  if not exists (select 1 from public.memberships where user_id = new.id) then
    v_name := coalesce(nullif(new.raw_user_meta_data->>'organization_name', ''), 'Mi Taller');
    insert into public.organizations (name, slug)
    values (v_name, public.slugify(v_name) || '-' || substr(replace(new.id::text, '-', ''), 1, 8))
    returning id into v_org;

    insert into public.memberships (user_id, organization_id, role)
    values (new.id, v_org, 'owner');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.organizations       enable row level security;
alter table public.memberships         enable row level security;
alter table public.customers           enable row level security;
alter table public.vehicles            enable row level security;
alter table public.service_categories  enable row level security;
alter table public.services            enable row level security;
alter table public.work_orders         enable row level security;
alter table public.work_order_items    enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.social_accounts     enable row level security;
alter table public.social_posts        enable row level security;
alter table public.bot_sessions        enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select using (id = auth.uid() or public.is_super_admin());
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- organizations
create policy organizations_select on public.organizations for select using (id = public.current_org_id() or public.is_super_admin());
create policy organizations_update on public.organizations for update using (id = public.current_org_id() or public.is_super_admin()) with check (id = public.current_org_id() or public.is_super_admin());

-- memberships (lectura propia / super-admin; escritura vía trigger/RPC definer)
create policy memberships_select on public.memberships for select using (user_id = auth.uid() or public.is_super_admin());

-- Patrón uniforme para tablas de tenant (org-scoped)
create policy customers_all          on public.customers          for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy vehicles_all           on public.vehicles           for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy service_categories_all on public.service_categories for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy services_all           on public.services           for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy work_orders_all        on public.work_orders        for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy conversations_all      on public.conversations      for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy messages_all           on public.messages           for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy social_accounts_all    on public.social_accounts    for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy social_posts_all       on public.social_posts       for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());
create policy bot_sessions_all       on public.bot_sessions       for all using (organization_id = public.current_org_id() or public.is_super_admin()) with check (organization_id = public.current_org_id() or public.is_super_admin());

-- work_order_items: hereda el aislamiento de su work_order padre
create policy work_order_items_all on public.work_order_items for all
  using (exists (select 1 from public.work_orders wo where wo.id = work_order_items.work_order_id and (wo.organization_id = public.current_org_id() or public.is_super_admin())))
  with check (exists (select 1 from public.work_orders wo where wo.id = work_order_items.work_order_id and (wo.organization_id = public.current_org_id() or public.is_super_admin())));

-- ----------------------------------------------------------------------------
-- 7. Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.conversations, public.work_orders;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 8. Grants (RLS sigue gobernando las filas)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

grant execute on function public.current_org_id()                    to anon, authenticated, service_role;
grant execute on function public.is_super_admin()                    to anon, authenticated, service_role;
grant execute on function public.slugify(text)                       to anon, authenticated, service_role;
grant execute on function public.ensure_org_for_current_user(text)   to authenticated, service_role;
