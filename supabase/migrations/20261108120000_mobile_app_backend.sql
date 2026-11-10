-- ITland mobile app backend: catalog curation, carousel, settings, customers and orders.
-- Everything is prefixed app_ so it never collides with the website's tables.
-- Security model (same as the website): anyone may read what the app shows; only
-- allow-listed admins (public.is_admin(), see 0001_admin_auth_and_public_forms.sql) may
-- change it; customers are Supabase anonymous users and only ever see their own rows.
--
-- Before customers can order: Supabase → Authentication → Providers → enable
-- "Allow anonymous sign-ins".

-- ── Settings (single row) ──────────────────────────────────────────────────────
create table if not exists public.app_settings (
  id             smallint primary key default 1 check (id = 1),
  delivery_fee   integer  not null default 5000 check (delivery_fee >= 0),
  store_phone    text     not null default '+9647501234567',
  whatsapp       text     not null default '+9647501234567',
  usd_iqd_rate   numeric  check (usd_iqd_rate is null or usd_iqd_rate > 0), -- null = use the live market rate
  price_round_to integer  not null default 250 check (price_round_to > 0),
  updated_at     timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ── Products shown in the app ──────────────────────────────────────────────────
-- Content is curated here; live price (USD) and stock come from Zoho through the
-- website's /api/products, matched on zoho_id. base_price_iqd is used when an item
-- has no Zoho match. A discount exists only when sale_price_iqd is set.
create table if not exists public.app_products (
  id             text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  zoho_id        text unique,
  brand          text not null,
  name           text not null check (char_length(name) between 1 and 160),
  model          text,
  category       text not null,
  sub            text not null default '',
  also_in        jsonb not null default '[]',
  specs          text not null default '',
  image_url      text,                       -- 'asset:<file>' for images bundled in the app, or a https URL
  colors         jsonb not null default '[]',
  key_features   jsonb not null default '[]',
  spec_table     jsonb not null default '[]',
  box            jsonb not null default '[]',
  connection     jsonb not null default '[]',
  works          jsonb not null default '[]',
  layouts        jsonb,
  editions       jsonb,
  setups         jsonb not null default '[]',
  watt           integer,
  ports          integer,
  warranty       integer not null default 12,
  base_price_iqd integer check (base_price_iqd is null or base_price_iqd > 0),
  stock_override integer,                    -- null = Zoho stock
  restock_date   date,
  sale_price_iqd integer check (sale_price_iqd is null or sale_price_iqd > 0),
  sale_ends_at   timestamptz,
  hidden         boolean not null default false,
  featured       boolean not null default false, -- "Best sellers"
  is_new         boolean not null default false,
  flash          boolean not null default false, -- needs a sale price to show
  sort           integer not null default 0,
  sold           integer not null default 0,
  updated_at     timestamptz not null default now()
);
create index if not exists app_products_category_idx on public.app_products (category, sort);

-- ── Home carousel slides ───────────────────────────────────────────────────────
create table if not exists public.app_banners (
  id           uuid primary key default gen_random_uuid(),
  position     integer not null default 0,
  active       boolean not null default true,
  eyebrow      jsonb not null default '{}',   -- {"en":..,"ar":..,"ku":..}
  title        jsonb not null default '{}',
  subtitle     jsonb not null default '{}',
  image_url    text,                          -- product image is used when empty
  product_id   text references public.app_products(id) on delete set null,
  link_type    text not null default 'product' check (link_type in ('product','category','brand','deals','none')),
  link_value   text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  updated_at   timestamptz not null default now()
);
create index if not exists app_banners_position_idx on public.app_banners (active, position);

-- ── Customers (one row per anonymous auth user) ────────────────────────────────
create table if not exists public.app_customers (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  phone       text not null check (phone ~ '^\+964[0-9]{10}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Orders ─────────────────────────────────────────────────────────────────────
create sequence if not exists public.app_order_number start 30001;

create table if not exists public.app_orders (
  id             text primary key default ('ITL-' || nextval('public.app_order_number')),
  customer_id    uuid not null references public.app_customers(id) on delete restrict,
  type           text not null default 'delivery' check (type in ('delivery','pickup')),
  status         text not null default 'placed'
                   check (status in ('placed','confirmed','packed','out','delivered','ready','picked')),
  special        text check (special in ('cancelled','failed','delayed','refunded')),
  times          jsonb not null default '{}',   -- {"placed": iso, "confirmed": iso, ...}
  city           text not null default 'erbil',
  branch         text,
  address        jsonb,                         -- snapshot: label, area, street, building, landmark, lat, lng
  receiver_name  text not null,
  receiver_phone text not null,
  note           text check (note is null or char_length(note) <= 500),
  slot           jsonb,                         -- {"day":"today","from":13,"to":16}
  pay            text not null default 'cod',
  subtotal       integer not null check (subtotal >= 0),
  discount       integer not null default 0 check (discount >= 0),
  delivery_fee   integer not null default 0 check (delivery_fee >= 0),
  total          integer not null check (total >= 0),
  courier_name   text,
  courier_phone  text,
  handover_code  text,
  pickup_code    text,
  new_eta        text,
  cancelled_by   text check (cancelled_by in ('you','store')),
  admin_note     text,
  client_ref     uuid,                          -- one per checkout attempt; makes placing an order safe to retry
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists app_orders_customer_idx on public.app_orders (customer_id, created_at desc);
create index if not exists app_orders_status_idx on public.app_orders (status, created_at desc);
create unique index if not exists app_orders_client_ref_idx on public.app_orders (customer_id, client_ref) where client_ref is not null;

create table if not exists public.app_order_items (
  id          bigint generated always as identity primary key,
  order_id    text not null references public.app_orders(id) on delete cascade,
  product_id  text not null,
  name        text not null,
  qty         integer not null check (qty between 1 and 99),
  unit_price  integer not null check (unit_price >= 0),
  options     jsonb not null default '{}'
);
create index if not exists app_order_items_order_idx on public.app_order_items (order_id);

-- ── Housekeeping triggers ──────────────────────────────────────────────────────
create or replace function public.app_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Stamp the time of every status the order reaches, so the app's timeline is real.
create or replace function public.app_order_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.times := jsonb_build_object(new.status, now());
  elsif new.status is distinct from old.status then
    new.times := coalesce(new.times, '{}'::jsonb) || jsonb_build_object(new.status, now());
  end if;
  return new;
end $$;

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings for each row execute function public.app_touch();
drop trigger if exists app_products_touch on public.app_products;
create trigger app_products_touch before update on public.app_products for each row execute function public.app_touch();
drop trigger if exists app_banners_touch on public.app_banners;
create trigger app_banners_touch before update on public.app_banners for each row execute function public.app_touch();
drop trigger if exists app_customers_touch on public.app_customers;
create trigger app_customers_touch before update on public.app_customers for each row execute function public.app_touch();
drop trigger if exists app_orders_stamp on public.app_orders;
create trigger app_orders_stamp before insert or update on public.app_orders for each row execute function public.app_order_stamp();

-- ── Placing and cancelling orders (the only way customers write orders) ────────
-- The server sets the owner, status, delivery fee and totals; the client only says
-- what it wants. Item prices are the app's displayed prices and are checked by the
-- store when it confirms the order.
create or replace function public.place_app_order(p_order jsonb, p_items jsonb)
returns public.app_orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_type text := coalesce(p_order->>'type', 'delivery');
  v_fee integer;
  v_subtotal integer;
  v_ref uuid := nullif(p_order->>'client_ref', '')::uuid;
  v_row public.app_orders;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  -- A retry of a checkout that already went through returns the same order instead of a duplicate.
  if v_ref is not null then
    select * into v_row from public.app_orders o where o.customer_id = v_uid and o.client_ref = v_ref;
    if v_row.id is not null then return v_row; end if;
  end if;
  if not exists (select 1 from public.app_customers c where c.id = v_uid) then
    raise exception 'customer profile missing';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'order needs 1 to 50 items';
  end if;
  if v_type not in ('delivery','pickup') then raise exception 'bad order type'; end if;

  select coalesce(sum((i->>'qty')::int * (i->>'unit_price')::int), 0) into v_subtotal
  from jsonb_array_elements(p_items) i;
  select case when v_type = 'pickup' then 0 else s.delivery_fee end into v_fee
  from public.app_settings s where s.id = 1;

  insert into public.app_orders (customer_id, type, status, city, branch, address, receiver_name, receiver_phone,
                                 note, slot, pay, subtotal, discount, delivery_fee, total, client_ref)
  values (v_uid, v_type, 'placed', coalesce(p_order->>'city', 'erbil'), p_order->>'branch', p_order->'address',
          p_order->>'receiver_name', p_order->>'receiver_phone', nullif(p_order->>'note', ''), p_order->'slot',
          coalesce(p_order->>'pay', 'cod'), v_subtotal, 0, coalesce(v_fee, 5000), v_subtotal + coalesce(v_fee, 5000), v_ref)
  returning * into v_row;

  insert into public.app_order_items (order_id, product_id, name, qty, unit_price, options)
  select v_row.id, i->>'product_id', i->>'name', (i->>'qty')::int, (i->>'unit_price')::int, coalesce(i->'options', '{}'::jsonb)
  from jsonb_array_elements(p_items) i;

  return v_row;
end $$;

-- Customers may cancel their own order until it is packed.
create or replace function public.cancel_app_order(p_id text)
returns public.app_orders
language plpgsql security definer set search_path = '' as $$
declare v_row public.app_orders;
begin
  update public.app_orders o
     set special = 'cancelled', cancelled_by = 'you'
   where o.id = p_id and o.customer_id = auth.uid()
     and o.status in ('placed','confirmed') and o.special is null
  returning * into v_row;
  if v_row.id is null then raise exception 'order cannot be cancelled'; end if;
  return v_row;
end $$;

revoke all on function public.place_app_order(jsonb, jsonb) from public, anon;
revoke all on function public.cancel_app_order(text) from public, anon;
grant execute on function public.place_app_order(jsonb, jsonb) to authenticated;
grant execute on function public.cancel_app_order(text) to authenticated;

-- ── Row level security ─────────────────────────────────────────────────────────
alter table public.app_settings    enable row level security;
alter table public.app_products    enable row level security;
alter table public.app_banners     enable row level security;
alter table public.app_customers   enable row level security;
alter table public.app_orders      enable row level security;
alter table public.app_order_items enable row level security;

revoke all on public.app_settings, public.app_products, public.app_banners, public.app_customers,
  public.app_orders, public.app_order_items from anon, authenticated;
revoke all on sequence public.app_order_number from anon, authenticated;

grant select on public.app_settings, public.app_products, public.app_banners to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
grant insert, update, delete on public.app_products, public.app_banners to authenticated;
grant select, insert, update on public.app_customers to authenticated;
grant select, update on public.app_orders to authenticated;
grant select on public.app_order_items to authenticated;

-- settings
drop policy if exists "app settings readable" on public.app_settings;
create policy "app settings readable" on public.app_settings for select to anon, authenticated using (true);
drop policy if exists "admins edit app settings" on public.app_settings;
create policy "admins edit app settings" on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins insert app settings" on public.app_settings;
create policy "admins insert app settings" on public.app_settings for insert to authenticated
  with check ((select public.is_admin()));

-- products: shoppers see visible ones, admins see and edit all
-- is_admin() may only be executed by signed-in users, so visitors get their own policy without it.
drop policy if exists "visible app products readable" on public.app_products;
create policy "visible app products readable" on public.app_products for select to anon, authenticated
  using (hidden = false);
drop policy if exists "admins read all app products" on public.app_products;
create policy "admins read all app products" on public.app_products for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "admins insert app products" on public.app_products;
create policy "admins insert app products" on public.app_products for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admins update app products" on public.app_products;
create policy "admins update app products" on public.app_products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins delete app products" on public.app_products;
create policy "admins delete app products" on public.app_products for delete to authenticated using ((select public.is_admin()));

-- banners: shoppers see active ones in their date window
drop policy if exists "live app banners readable" on public.app_banners;
create policy "live app banners readable" on public.app_banners for select to anon, authenticated
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
drop policy if exists "admins read all app banners" on public.app_banners;
create policy "admins read all app banners" on public.app_banners for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "admins insert app banners" on public.app_banners;
create policy "admins insert app banners" on public.app_banners for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admins update app banners" on public.app_banners;
create policy "admins update app banners" on public.app_banners for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins delete app banners" on public.app_banners;
create policy "admins delete app banners" on public.app_banners for delete to authenticated using ((select public.is_admin()));

-- customers: own row; admins read all
drop policy if exists "customers read own profile" on public.app_customers;
create policy "customers read own profile" on public.app_customers for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "customers create own profile" on public.app_customers;
create policy "customers create own profile" on public.app_customers for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists "customers update own profile" on public.app_customers;
create policy "customers update own profile" on public.app_customers for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- orders: customers read their own (writes go through the functions above); admins manage all
drop policy if exists "customers read own orders" on public.app_orders;
create policy "customers read own orders" on public.app_orders for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "admins update orders" on public.app_orders;
create policy "admins update orders" on public.app_orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "customers read own order items" on public.app_order_items;
create policy "customers read own order items" on public.app_order_items for select to authenticated
  using (exists (select 1 from public.app_orders o where o.id = order_id
                 and (o.customer_id = (select auth.uid()) or (select public.is_admin()))));

-- ── Live order updates in the app ──────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'app_orders') then
    alter publication supabase_realtime add table public.app_orders;
  end if;
end $$;

-- ── Images uploaded from the dashboard ─────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('app-media', 'app-media', true) on conflict (id) do nothing;
drop policy if exists "app media public read" on storage.objects;
create policy "app media public read" on storage.objects for select to anon, authenticated using (bucket_id = 'app-media');
drop policy if exists "admins upload app media" on storage.objects;
create policy "admins upload app media" on storage.objects for insert to authenticated
  with check (bucket_id = 'app-media' and (select public.is_admin()));
drop policy if exists "admins change app media" on storage.objects;
create policy "admins change app media" on storage.objects for update to authenticated
  using (bucket_id = 'app-media' and (select public.is_admin()));
drop policy if exists "admins delete app media" on storage.objects;
create policy "admins delete app media" on storage.objects for delete to authenticated
  using (bucket_id = 'app-media' and (select public.is_admin()));
