-- ITland app backend v2: the whole Zoho catalog, IQD prices worked out on the server, real
-- customer accounts. Applies on top of 20261108120000_mobile_app_backend.sql.
--
-- * Every Zoho Books item is synced into app_zoho_items every 10 minutes (pg_cron + pg_net) from
--   the website's public /api/products, so no Zoho credentials live in the database. On the way
--   in, names are cleaned (the website's rules) and each item gets a brand and an app category.
-- * USD -> IQD comes from the Tawaf project's currency_rates table (IQWealth Baghdad market,
--   refreshed hourly there) and the website's /api/currency (same feed, same checks); the newest
--   valid observation of the two wins, and nothing older than 3 days is used. The dashboard's
--   app_settings.usd_iqd_rate still overrides both.
-- * app_products is now an optional overlay on a Zoho item: curated content, hide, featured,
--   new, sale price, stock override, category override. Every other Zoho item shows as it is.
-- * app_catalog() returns the finished catalog (IQD prices, stock, banners, settings), the same
--   for both apps. place_app_order() prices every line itself and refuses stale prices, unknown
--   or sold-out products and anonymous sessions.
-- * Customers have real accounts (email + password confirmed by a code, Apple, Google) and can
--   delete them (delete_my_app_account): orders stay for the store's records without personal
--   details.
-- * is_admin() also requires a confirmed email, so an unconfirmed sign-up can never claim an
--   allow-listed admin address.
--
-- After applying: insert the Tawaf publishable key (see app_private.config below) and run
-- select public.app_sync_run(); twice, a minute apart, to fill the catalog straight away.

-- ── Extensions ─────────────────────────────────────────────────────────────────
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- ── Private schema: never exposed through the API ──────────────────────────────
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table if not exists app_private.config (
  key   text primary key,   -- 'tawaf_url', 'tawaf_key', 'site_url'
  value text not null
);
insert into app_private.config (key, value) values
  ('site_url', 'https://itlandforcomputer.com'),
  ('tawaf_url', 'https://wvgrdmzezwdwcyicwgev.supabase.co')
on conflict (key) do nothing;
-- The Tawaf publishable key is added by hand (it is public, but kept out of this repo):
--   insert into app_private.config values ('tawaf_key', '<publishable key>') on conflict (key) do update set value = excluded.value;

create table if not exists app_private.sync_requests (
  kind       text primary key check (kind in ('products','fx_tawaf','fx_site')),
  request_id bigint not null,
  sent_at    timestamptz not null default now()
);
alter table app_private.config enable row level security;
alter table app_private.sync_requests enable row level security;

-- ── Admins need a confirmed email ──────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.admin_users a
    join auth.users u on u.id = auth.uid()
    where lower(a.email) = lower(coalesce(auth.jwt()->>'email', ''))
      and lower(u.email) = lower(a.email)
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ── Settings: sync status, live rate, the real store number ────────────────────
alter table public.app_settings
  add column if not exists fx_rate           numeric check (fx_rate is null or fx_rate between 500 and 5000),
  add column if not exists fx_as_of          timestamptz,
  add column if not exists fx_source         text check (fx_source is null or fx_source in ('tawaf','website')),
  add column if not exists catalog_synced_at timestamptz,
  add column if not exists catalog_items     integer,
  add column if not exists sync_error        text,
  add column if not exists sync_error_at     timestamptz,
  add column if not exists show_out_of_stock boolean not null default true;
alter table public.app_settings
  alter column store_phone set default '+9647504888570',
  alter column whatsapp    set default '+9647504888570';
update public.app_settings set store_phone = '+9647504888570' where store_phone = '+9647501234567';
update public.app_settings set whatsapp    = '+9647504888570' where whatsapp    = '+9647501234567';

-- ── Zoho items, as synced ──────────────────────────────────────────────────────
create table if not exists public.app_zoho_items (
  zoho_id       text primary key,
  raw_name      text not null default '',          -- Zoho's own name (often a code)
  name          text not null,                     -- cleaned title shown in the app
  description   text not null default '',
  brand         text not null default '',          -- display name, '' when unknown
  brand_id      text not null default 'other',
  category      text not null default 'other',     -- app category id
  sub           text not null default '',
  usd_price     numeric not null default 0 check (usd_price >= 0),
  stock         integer,                           -- Zoho stock_on_hand; null = no figure
  image_url     text,
  zoho_featured boolean not null default false,
  zoho_order    integer not null default 0,
  kind          text not null default 'goods',     -- Zoho product_type: goods | service
  active        boolean not null default true,     -- false once it is gone from Zoho
  first_seen_at timestamptz not null default now(),
  changed_at    timestamptz not null default now()
);
create index if not exists app_zoho_items_category_idx on public.app_zoho_items (category) where active;

alter table public.app_zoho_items enable row level security;
revoke all on public.app_zoho_items from anon, authenticated;
grant select on public.app_zoho_items to authenticated;
drop policy if exists "admins read zoho items" on public.app_zoho_items;
create policy "admins read zoho items" on public.app_zoho_items for select to authenticated
  using ((select public.is_admin()));

-- ── app_products becomes an overlay on a Zoho item ─────────────────────────────
-- name/brand/category may now be empty: the Zoho item's values are used.
alter table public.app_products
  alter column brand    drop not null,
  alter column name     drop not null,
  alter column category drop not null;
-- Everything comes from Zoho now: the two sample products that were never in Zoho go.
delete from public.app_products where zoho_id is null;

-- ── Customers: real accounts ───────────────────────────────────────────────────
-- Apple and Google accounts may arrive without a name or phone; the app asks for them before
-- the first order (every order still carries its own receiver name and phone).
alter table public.app_customers
  alter column name  drop not null,
  alter column phone drop not null,
  add column if not exists email text;
alter table public.app_customers drop constraint if exists app_customers_phone_check;
alter table public.app_customers add constraint app_customers_phone_check
  check (phone is null or phone ~ '^\+964[0-9]{10}$');

create or replace function app_private.customer_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.email := (select u.email from auth.users u where u.id = new.id);
  return new;
end $$;
drop trigger if exists app_customers_email on public.app_customers;
create trigger app_customers_email before insert or update on public.app_customers
  for each row execute function app_private.customer_email();

-- Orders outlive a deleted account (store records), without the personal details.
alter table public.app_orders alter column customer_id drop not null;
alter table public.app_orders drop constraint if exists app_orders_customer_id_fkey;
alter table public.app_orders add constraint app_orders_customer_id_fkey
  foreign key (customer_id) references public.app_customers(id) on delete set null;
alter table public.app_order_items add column if not exists zoho_id text;

-- ── Text rules (generated from the tested rules; keep in step with the app docs) ──
create or replace function app_private.clean_text(p text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(string_agg(l, E'\n' order by n), '')
  from (
    select n, regexp_replace(regexp_replace(regexp_replace(regexp_replace(line,
             '\(?\y(office|wholesale|purchase|cost)\s*price\y[^\n]*', '', 'gi'), '[ \t]+', ' ', 'g'), '[\s(,;:-]+$', ''), '^\s+|\s+$', '', 'g') as l
    from regexp_split_to_table(coalesce(p, ''), E'\n') with ordinality as t(line, n)
  ) s
  where l <> '';
$$;

-- The website's title rule: Zoho names that are only a code fall back to the description's
-- first line; long titles are cut at a word near 117 characters.
create or replace function app_private.clean_title(p_name text, p_desc text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  n text := app_private.clean_text(p_name);
  d text := app_private.clean_text(p_desc);
  t text; sh text; e integer;
begin
  if (n = '' or n ~ '^[0-9]+$' or n ~ '^[0-9]{6,}\y' or n ~ '^[0-9][0-9 -]{5,}$' or char_length(n) <= 4)
     and char_length(d) > 3 then
    t := split_part(d, E'\n', 1);
  else
    t := n;
  end if;
  if t = '' then t := 'Product'; end if;
  if char_length(t) <= 120 then return t; end if;
  sh := left(t, 117);
  e := char_length(sh) - strpos(reverse(sh), ' ');
  return regexp_replace(left(sh, case when e > 80 then e else 117 end), '[\s,;:-]+$', '') || '…';
end $$;

create or replace function app_private.detect_brand(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare b text; t text := coalesce(p, '');
begin
  foreach b in array array['Logitech', 'Razer', 'Onten', 'Lention', 'Anker', 'Elgato', 'JBL', 'Poly', 'Plantronics', 'Jabra', 'Apple', 'Dell', 'Sony', 'Samsung', 'HyperX', 'SteelSeries', 'Corsair', 'Redragon', 'Baseus', 'UGREEN', 'AULA', 'Fifine', 'Maono', 'Bose', 'Sennheiser', 'Audio-Technica', 'Sandisk', 'Kingston', 'Western Digital', 'WD', 'Seagate', 'TP-Link', 'D-Link', 'Mercusys', 'Lenovo', 'HP', 'Asus', 'Acer', 'MSI', 'Xiaomi', 'Hikvision', 'Dahua', 'EZVIZ', 'Crucial', 'Belkin', 'Promate', 'Porodo', 'Green Lion', 'Hoco', 'Borofone', 'Meetion', 'Fantech', 'A4Tech', 'Bloody', 'Edifier', 'Vention', 'Microsoft', 'Yealink', 'Huawei', 'Orico', 'Havit', 'Cooler Master', 'Gamdias', 'Xigmatek', 'Thermaltake', 'DeepCool', 'Lian Li', 'Montech', 'Arctic', 'Aigo', 'Darkflash', 'Logi', 'Blackshark', 'Kraken']::text[] loop
    if t ~* ('\y' || b || '\y') then
      b := case b when 'Plantronics' then 'Poly' when 'Logi' then 'Logitech' when 'Blackshark' then 'Razer' when 'Kraken' then 'Razer' else b end;
      if b = 'Logitech' and t ~* '\y(logitech g|g pro|pro x|lightspeed|g[0-9]{3}x?|astro)\y' then return 'Logitech G'; end if;
      return b;
    end if;
  end loop;
  return '';
end $$;

create or replace function app_private.slug(p text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'other');
$$;

-- {category, sub} in the app's ids. Order matters: the first rule that matches wins.
create or replace function app_private.detect_category(p text)
returns text[] language plpgsql immutable set search_path = '' as $$
declare
  t text := regexp_replace(coalesce(p, ''), '\yg hub\y', ' ', 'gi');
  w text := case when t ~* '\y(wireless|bluetooth|lightspeed|bolt|unifying|2\.4 ?g)\y' then 'wireless' else 'wired' end;
  mouse boolean := t ~* '\y(mouse|mice|trackball|mx (master|anywhere|vertical|ergo)|lift vertical)\y' or (t ~* '\ym[0-9]{3}[a-z]?\y' and t ~* '\ylogi(tech)?\y');
  g boolean := t ~* '\y(gaming|gamer|esports?|lightspeed|g pro|pro x|razer|hyperx|steelseries|redragon|blackshark|kraken|deathadder|viper|basilisk|astro|g[0-9]{3}x?)\y';
begin
  if t ~* '\y(gamepad|game ?pad|controller|joystick|racing wheel|steering wheel|driving force|g29|g920|g923|shifter|pedals?)\y' then return array['gaming','wheels']; end if;
  if t ~* '\ycombo\y|keyboard\s*(and|&|\+|with|/)\s*mouse|mouse\s*(and|&|\+|/)\s*keyboard|\ymk[0-9]{3}\y|desktop set' then return array['combos', w]; end if;
  if t ~* '\y(presenter|presentation|laser pointer|pointer|spotlight|r400|r500s?|r800)\y' then return array['presenters','presenters']; end if;
  if t ~* '\y(headsets?|headphones?|earphones?|earbuds?|airpods|blackwire|voyager|evolve2?|zone (vibe|wireless|wired|[0-9]{3})|kraken|blackshark|h[0-9]{3}e?|poly [0-9]{4})\y' then
    return case when g then array['gaming','headsets'] when t ~* '\y(uc|teams|zoom|office|mono|business|call|ms)\y' then array['headsets','office'] else array['headsets', w] end;
  end if;
  if mouse and not t ~* '\y(keyboard|keypad|numpad|numeric|numaric|keys|tkl)\y|\yk[0-9]{3}\y' then
    return case when g then array['gaming','mice'] when t ~* '\y(vertical|ergonomic|ergo|lift|trackball)\y' then array['mice','ergonomic'] else array['mice', w] end;
  end if;
  if t ~* '\y(keyboard|keypad|numpad|numeric|numaric|keys|tkl)\y|\yk[0-9]{3}\y' then
    return case when g then array['gaming','keyboards'] when t ~* '\ymechanical\y' then array['keyboards','mechanical'] else array['keyboards', w] end;
  end if;
  if mouse then return case when g then array['gaming','mice'] else array['mice', w] end; end if;
  if t ~* '\y(stand|stands|mount|mounts|holder|bracket|riser|monitor arm|laptop arm)\y' then return array['stands','']; end if;
  if t ~* '\y(webcam|web cam|conferencecam|conference ?cam|brio|streamcam|c[0-9]{3}e?|bcc950|ptz|camera|mevo)\y' then return array['webcams','webcams']; end if;
  if t ~* '\y(microphones?|mics?|lavalier|lapel|condenser|podcast|vlog)\y' and not t ~* '\y(hub|dock|docking|multiport|multi-?port|multi-?function)\y' then return array['webcams','mics']; end if;
  if t ~* '\y(hub|dock|docking|multiport|multi-?port|multi-?function)\y' then return case when t ~* '\y(dock|docking)\y' then array['hubs','docks'] else array['hubs','hubs'] end; end if;
  if t ~* '[0-9]+ ?(gb|tb)\y|\y(ssd|hdd|nvme|m\.2|hard (disk|drive)|enclosure|hard case|flash (drive|disk|memory)|usb (flash|drive)|memory card|micro ?sd card|blu-?ray|dvd|cd-?rom|optical drive|card reader)\y' then return array['storage','']; end if;
  if t ~* '\y(cable|cables|cord|extension)\y' then
    return array['cables', case when t ~* '\y(hdmi|hdtv)\y' then 'hdmi' when t ~* '\y(usb-?c|type-?c|thunderbolt|usb4)\y' then 'usb-c' when t ~* '\y(dp|displayport|vga|dvi)\y' then 'display' else '' end];
  end if;
  if t ~* '\y(switch|splitter|kvm|extender)\y' then return array['adapters','video']; end if;
  if t ~* '\y(power ?bank|powercore|portable charger)\y' then return array['powerbanks','']; end if;
  if t ~* '\y(speakers?|speakerphone|soundbar|speak [0-9]{3}|sync [0-9]{2}\+?|p710e?|z[0-9]{3}|edifier)\y' then return case when t ~* '\y(speakerphone|conference|speak2?|sync|rally|p710e?|meeting)\y' then array['speakers','conference'] else array['speakers','desktop'] end; end if;
  if t ~* '\y(video conferencing|conferencing|logitech group|rally|meetup|video ?bars?)\y' then return array['webcams','webcams']; end if;
  if t ~* '\y(charger|chargers|charging station|charging stand|gan|wall plug|car charger|power adapter|power delivery|[0-9]{2,3}w)\y' then return array['chargers', case when t ~* '\ycar\y' then 'car' else '' end]; end if;
  if t ~* '[0-9]-?fans?\y|\y(case|chassis|fans?|cooler|cooling|argb|psu|power supply|motherboard|cpu|processor|ram|ddr[345]|graphics card|gpu|thermal paste|liquid cooler|aio)\y' then return array['components','']; end if;
  if t ~* '\y(network|adapter|adaptor|converter|otg|ethernet|rj45|lan|sound card|capture card|capture|receiver|dongle|vga|hdmi|displayport|dp|type-?c|usb-?c|bluetooth)\y' then
    return array['adapters', case when t ~* '\y(hdmi|hdtv|vga|dp|displayport|dvi)\y' then 'video' when t ~* '\y(ethernet|lan|rj45|network)\y' then 'network' when t ~* '\yotg\y' then 'otg' else '' end];
  end if;
  return array['other',''];
end $$;

-- ── Prices ─────────────────────────────────────────────────────────────────────
-- The rate in use: the dashboard override, else the synced market rate while it is under 3 days old.
create or replace function app_private.fx()
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(s.usd_iqd_rate, case when s.fx_as_of > now() - interval '3 days' then s.fx_rate end)
  from public.app_settings s where s.id = 1;
$$;

-- USD -> IQD rounded to the nearest step (250 by default); null when it cannot be converted.
create or replace function app_private.iqd(p_usd numeric, p_rate numeric, p_step integer)
returns integer language sql immutable set search_path = '' as $$
  select case when p_usd > 0 and p_rate > 0
              then (round(p_usd * p_rate / greatest(coalesce(p_step, 250), 1)) * greatest(coalesce(p_step, 250), 1))::integer end;
$$;

-- ── Sync: ingest ───────────────────────────────────────────────────────────────
create or replace function app_private.ingest_zoho(p jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer; v_ids text[];
  v_site text := rtrim(coalesce((select value from app_private.config where key = 'site_url'), 'https://itlandforcomputer.com'), '/');
begin
  if jsonb_typeof(p) is distinct from 'array' then raise exception 'products is not a list'; end if;
  n := jsonb_array_length(p);
  -- A broken or empty response must never wipe the shop.
  if n < 50 then raise exception 'only % products in the response; the last catalog is kept', n; end if;

  create temporary table if not exists pg_temp.app_sync_src (
    zoho_id text, raw_name text, name text, description text, brand text, category text, sub text,
    usd_price numeric, stock integer, image_url text, featured boolean, ord integer, kind text
  ) on commit drop;
  truncate pg_temp.app_sync_src;

  insert into pg_temp.app_sync_src
  select distinct on (zid)
    zid,
    left(coalesce(x->>'name', ''), 300),
    app_private.clean_title(x->>'name', x->>'description'),
    left(app_private.clean_text(x->>'description'), 2000),
    coalesce(nullif(btrim(x->>'brand'), ''), app_private.detect_brand(txt)),
    cs[1], cs[2],
    case when jsonb_typeof(x->'price') = 'number' then greatest((x->>'price')::numeric, 0) else 0 end,
    case when jsonb_typeof(x->'stock_on_hand') = 'number' then floor((x->>'stock_on_hand')::numeric)::integer end,
    -- Photos hosted on the website come as '/product_images/...'.
    (select case when i ~ '^https?://' then i else v_site || i end
       from jsonb_array_elements_text(case when jsonb_typeof(x->'images') = 'array' then x->'images' else '[]'::jsonb end) i
      where (i ~ '^https?://' or i ~ '^/[^/]') and strpos(i, 'photo-1552820728-8b83bb6b773f') = 0 limit 1),
    case when jsonb_typeof(x->'featured') = 'boolean' then (x->>'featured')::boolean else false end,
    ord,
    coalesce(nullif(x->>'category', ''), 'goods')
  from (
    select coalesce(x->>'zoho_item_id', x->>'id') as zid, x, (ord - 1)::integer as ord,
           coalesce(x->>'name', '') || ' ' || coalesce(x->>'description', '') as txt,
           app_private.detect_category(coalesce(x->>'name', '') || ' ' || coalesce(x->>'description', '')) as cs
    from jsonb_array_elements(p) with ordinality as e(x, ord)
    where jsonb_typeof(x) = 'object' and coalesce(x->>'zoho_item_id', x->>'id') is not null
  ) src
  order by zid, ord;

  insert into public.app_zoho_items as z (zoho_id, raw_name, name, description, brand, brand_id, category, sub,
                                           usd_price, stock, image_url, zoho_featured, zoho_order, kind, active, changed_at)
  select s.zoho_id, s.raw_name, s.name, s.description, s.brand,
         case when s.brand = '' then 'other' else app_private.slug(s.brand) end,
         s.category, s.sub, s.usd_price, s.stock, s.image_url, s.featured, s.ord, s.kind, true, now()
  from pg_temp.app_sync_src s
  on conflict (zoho_id) do update set
    raw_name = excluded.raw_name, name = excluded.name, description = excluded.description,
    brand = excluded.brand, brand_id = excluded.brand_id, category = excluded.category, sub = excluded.sub,
    usd_price = excluded.usd_price, stock = excluded.stock, image_url = excluded.image_url,
    zoho_featured = excluded.zoho_featured, zoho_order = excluded.zoho_order, kind = excluded.kind,
    active = true, changed_at = now()
  where (z.raw_name, z.name, z.description, z.brand, z.brand_id, z.category, z.sub, z.usd_price, z.stock,
         z.image_url, z.zoho_featured, z.zoho_order, z.kind, z.active)
        is distinct from
        (excluded.raw_name, excluded.name, excluded.description, excluded.brand, excluded.brand_id, excluded.category,
         excluded.sub, excluded.usd_price, excluded.stock, excluded.image_url, excluded.zoho_featured, excluded.zoho_order,
         excluded.kind, true);

  select array_agg(zoho_id) into v_ids from pg_temp.app_sync_src;
  update public.app_zoho_items set active = false, changed_at = now()
   where active and not (zoho_id = any(v_ids));

  update public.app_settings
     set catalog_synced_at = now(),
         catalog_items = (select count(*) from public.app_zoho_items where active)
   where id = 1;
  return n;
end $$;

-- Picks the newest valid IQWealth observation from Tawaf's currency_rates row and the website's
-- /api/currency. Each must be the Baghdad market feed, 500..5000 IQD, and under 3 days old.
create or replace function app_private.ingest_fx(p_tawaf jsonb, p_site jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  t jsonb := case when jsonb_typeof(p_tawaf) = 'array' then p_tawaf->0 else p_tawaf end;
  r numeric; a timestamptz;
  best_r numeric; best_a timestamptz; best_s text;
begin
  begin
    if t->>'source' = 'auto' and t->>'provider' = 'IQWealth Baghdad market' and jsonb_typeof(t->'iqd_per_unit') = 'number' then
      r := (t->>'iqd_per_unit')::numeric; a := (t->>'provider_updated_at')::timestamptz;
      if r between 500 and 5000 and a <= now() + interval '5 minutes' and a > now() - interval '3 days' then
        best_r := r; best_a := a; best_s := 'tawaf';
      end if;
    end if;
  exception when others then null;
  end;
  begin
    if p_site->>'provider' = 'IQWealth Baghdad market' and jsonb_typeof(p_site->'rate') = 'number' then
      r := (p_site->>'rate')::numeric; a := (p_site->>'asOf')::timestamptz;
      if r between 500 and 5000 and a <= now() + interval '5 minutes' and a > now() - interval '3 days'
         and (best_a is null or a > best_a) then
        best_r := r; best_a := a; best_s := 'website';
      end if;
    end if;
  exception when others then null;
  end;
  if best_r is null then raise exception 'no fresh IQD market rate from Tawaf or the website'; end if;
  update public.app_settings
     set fx_rate = round(best_r, 4), fx_as_of = best_a, fx_source = best_s
   where id = 1 and (fx_as_of is null or best_a >= fx_as_of or fx_as_of <= now() - interval '3 days');
  return best_s;
end $$;

-- ── Sync: requests (pg_net answers asynchronously, so each run collects the last run's answers) ──
create or replace function app_private.sync_collect()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q record; resp record;
  v_products jsonb; v_tawaf jsonb; v_site jsonb; v_fx_seen boolean := false;
  v_done text[] := '{}'; v_err text[] := '{}'; n integer;
begin
  for q in select * from app_private.sync_requests loop
    select r.status_code, r.content, r.timed_out, r.error_msg into resp from net._http_response r where r.id = q.request_id;
    if not found then
      if q.sent_at < now() - interval '5 minutes' then
        v_err := v_err || (q.kind || ': no answer');
        delete from app_private.sync_requests where kind = q.kind;
      end if;
      continue;
    end if;
    delete from app_private.sync_requests where kind = q.kind;
    if coalesce(resp.timed_out, false) or resp.status_code is distinct from 200 then
      v_err := v_err || format('%s: %s', q.kind, coalesce(resp.error_msg, 'HTTP ' || resp.status_code::text));
      continue;
    end if;
    begin
      case q.kind
        when 'products' then v_products := resp.content::jsonb;
        when 'fx_tawaf' then v_tawaf := resp.content::jsonb; v_fx_seen := true;
        when 'fx_site'  then v_site  := resp.content::jsonb; v_fx_seen := true;
      end case;
    exception when others then
      v_err := v_err || (q.kind || ': unreadable answer');
    end;
  end loop;

  if v_products is not null then
    begin
      n := app_private.ingest_zoho(v_products->'products');
      v_done := v_done || format('products: %s', n);
    exception when others then
      v_err := v_err || ('products: ' || sqlerrm);
    end;
  end if;
  if v_fx_seen then
    begin
      v_done := v_done || ('rate: ' || app_private.ingest_fx(v_tawaf, v_site));
    exception when others then
      v_err := v_err || ('rate: ' || sqlerrm);
    end;
  end if;

  if cardinality(v_err) > 0 then
    update public.app_settings set sync_error = array_to_string(v_err, '; '), sync_error_at = now() where id = 1;
  elsif cardinality(v_done) > 0 then
    update public.app_settings set sync_error = null, sync_error_at = null where id = 1;
  end if;
  return jsonb_build_object('done', to_jsonb(v_done), 'errors', to_jsonb(v_err));
end $$;

create or replace function app_private.sync_send()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_site  text := (select value from app_private.config where key = 'site_url');
  v_tawaf text := (select value from app_private.config where key = 'tawaf_url');
  v_key   text := (select value from app_private.config where key = 'tawaf_key');
begin
  insert into app_private.sync_requests (kind, request_id)
  values ('products', net.http_get(url := v_site || '/api/products', timeout_milliseconds := 30000)),
         ('fx_site',  net.http_get(url := v_site || '/api/currency', timeout_milliseconds := 15000))
  on conflict (kind) do update set request_id = excluded.request_id, sent_at = now();
  if v_key is not null then
    insert into app_private.sync_requests (kind, request_id)
    values ('fx_tawaf', net.http_get(
      url := v_tawaf || '/rest/v1/currency_rates?code=eq.USD&select=iqd_per_unit,source,provider,provider_updated_at',
      headers := jsonb_build_object('apikey', v_key),
      timeout_milliseconds := 15000))
    on conflict (kind) do update set request_id = excluded.request_id, sent_at = now();
  end if;
end $$;

-- Run by pg_cron every 10 minutes: apply the answers to the previous run, then ask again.
create or replace function public.app_sync_run()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  v := app_private.sync_collect();
  perform app_private.sync_send();
  return v;
end $$;
revoke all on function public.app_sync_run() from public, anon, authenticated;

-- Dashboard: "Sync now" sends fresh requests; "status" applies any answers that have arrived.
create or replace function public.app_sync_now()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return public.app_sync_run();
end $$;

create or replace function public.app_sync_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  v := app_private.sync_collect();
  return v || (select jsonb_build_object(
    'catalog_synced_at', s.catalog_synced_at, 'catalog_items', s.catalog_items,
    'fx_rate', s.fx_rate, 'fx_as_of', s.fx_as_of, 'fx_source', s.fx_source, 'usd_iqd_rate', s.usd_iqd_rate,
    'rate_in_use', app_private.fx(), 'sync_error', s.sync_error, 'sync_error_at', s.sync_error_at,
    'pending', (select count(*) from app_private.sync_requests))
    from public.app_settings s where s.id = 1);
end $$;
revoke all on function public.app_sync_now() from public, anon;
revoke all on function public.app_sync_status() from public, anon;
grant execute on function public.app_sync_now() to authenticated;
grant execute on function public.app_sync_status() to authenticated;

-- ── The catalog ────────────────────────────────────────────────────────────────
-- One row per product the app can show: overlay rows (with their Zoho item) and every other
-- active Zoho item. Colour variants named in an overlay's colors[].zohoId are not separate products.
create or replace function app_private.catalog_rows()
returns table (id text, zoho_id text, name text, price integer, stock integer, colors jsonb, sort_key numeric, payload jsonb)
language sql stable security definer set search_path = '' as $$
with st as (
  select app_private.fx() as rate, greatest(coalesce(s.price_round_to, 250), 1) as rnd, s.show_out_of_stock as soos
  from public.app_settings s where s.id = 1
),
consumed as (
  select p.zoho_id as zid from public.app_products p where p.zoho_id is not null
  union
  select c->>'zohoId' from public.app_products p
  cross join lateral jsonb_array_elements(case when jsonb_typeof(p.colors) = 'array' then p.colors else '[]'::jsonb end) c
  where c->>'zohoId' is not null
),
base as (
  select p.id, p.zoho_id,
         coalesce(nullif(p.name, ''), z.name) as name,
         coalesce(nullif(p.brand, ''), z.brand_id, 'other') as brand_id,
         case when nullif(p.brand, '') is null or p.brand = z.brand_id then coalesce(nullif(z.brand, ''), initcap(replace(coalesce(nullif(p.brand, ''), z.brand_id, 'other'), '-', ' ')))
              else initcap(replace(p.brand, '-', ' ')) end as brand_name,
         coalesce(nullif(p.category, ''), z.category, 'other') as category,
         case when nullif(p.category, '') is not null then coalesce(p.sub, '') else coalesce(z.sub, '') end as sub,
         coalesce(z.description, '') as description,
         coalesce(nullif(p.image_url, ''), z.image_url) as image_url,
         coalesce(app_private.iqd(z.usd_price, st.rate, st.rnd), p.base_price_iqd) as regular,
         p.sale_price_iqd, p.sale_ends_at,
         greatest(coalesce(p.stock_override, z.stock, 0), 0) as stock,
         p.restock_date,
         case when jsonb_typeof(p.colors) = 'array' then p.colors else '[]'::jsonb end as colors,
         true as curated,
         p.featured or coalesce(z.zoho_featured, false) as featured,
         p.is_new, p.flash,
         p.sort::numeric as sort_key,
         to_jsonb(p) as r,
         (p.zoho_id is null or (z.zoho_id is not null and z.active and z.kind = 'goods')) as alive
  from public.app_products p
  left join public.app_zoho_items z on z.zoho_id = p.zoho_id
  cross join st
  where not p.hidden
  union all
  select 'z-' || z.zoho_id, z.zoho_id, z.name, z.brand_id,
         nullif(z.brand, ''), z.category, z.sub, z.description, z.image_url,
         app_private.iqd(z.usd_price, st.rate, st.rnd),
         null, null, greatest(coalesce(z.stock, 0), 0), null, '[]'::jsonb, false, z.zoho_featured, false, false,
         (100000 + z.zoho_order)::numeric, null, true
  from public.app_zoho_items z
  cross join st
  where z.active and z.kind = 'goods' and not exists (select 1 from consumed c where c.zid = z.zoho_id)
),
priced as (
  select b.*,
         (b.sale_price_iqd is not null and b.sale_price_iqd > 0 and b.regular is not null and b.sale_price_iqd < b.regular
          and (b.sale_ends_at is null or b.sale_ends_at > now())) as on_sale
  from base b
  where b.alive and b.regular is not null and b.regular > 0
),
final as (
  select pr.*,
         case when pr.on_sale then pr.sale_price_iqd else pr.regular end as price,
         case when pr.on_sale then pr.regular end as old_price,
         (select coalesce(jsonb_agg(c || jsonb_build_object('price', x.cp, 'old', x.co, 'stock', x.cs) order by e.ord), '[]'::jsonb)
            from jsonb_array_elements(pr.colors) with ordinality as e(c, ord)
            left join public.app_zoho_items cz on cz.zoho_id = c->>'zohoId' and cz.active
            cross join st
            cross join lateral (select coalesce(app_private.iqd(cz.usd_price, st.rate, st.rnd), pr.regular) as creg) g
            cross join lateral (select
               case when pr.on_sale and pr.sale_price_iqd < g.creg then pr.sale_price_iqd else g.creg end as cp,
               case when pr.on_sale and pr.sale_price_iqd < g.creg then g.creg end as co,
               case when c->>'zohoId' is null or c->>'zohoId' = pr.zoho_id then pr.stock
                    else greatest(coalesce(cz.stock, 0), 0) end as cs) x) as colors_out
  from priced pr
)
select f.id, f.zoho_id, f.name, f.price, f.stock, f.colors_out, f.sort_key,
       -- Empty values are left out to keep the response small; the apps read a missing key as empty.
       jsonb_strip_nulls(jsonb_build_object(
         'id', f.id, 'zohoId', f.zoho_id, 'brand', f.brand_id, 'brandName', f.brand_name, 'name', f.name,
         'model', nullif(f.r->>'model', ''), 'cat', f.category, 'sub', nullif(f.sub, ''),
         'alsoIn', nullif(f.r->'also_in', '[]'::jsonb), 'specs', nullif(f.r->>'specs', ''),
         'desc', nullif(nullif(f.description, ''), f.name),
         'price', f.price, 'old', f.old_price, 'saleEnds', case when f.on_sale then f.sale_ends_at end,
         'stock', f.stock, 'restock', f.restock_date, 'img', f.image_url, 'colors', nullif(f.colors_out, '[]'::jsonb),
         'connection', nullif(f.r->'connection', '[]'::jsonb), 'works', nullif(f.r->'works', '[]'::jsonb),
         'watt', f.r->'watt', 'ports', f.r->'ports', 'layouts', f.r->'layouts', 'editions', f.r->'editions',
         'setups', nullif(f.r->'setups', '[]'::jsonb),
         'keyFeatures', nullif(f.r->'key_features', '[]'::jsonb), 'specTable', nullif(f.r->'spec_table', '[]'::jsonb),
         'box', nullif(f.r->'box', '[]'::jsonb),
         'flags', jsonb_build_object('best', f.featured, 'new', coalesce(f.is_new, false), 'flash', coalesce(f.flash, false) and f.on_sale),
         'curated', f.curated, 'sort', f.sort_key))
from final f
cross join st
where st.soos or f.stock > 0
   or exists (select 1 from jsonb_array_elements(f.colors_out) c where (c->>'stock')::integer > 0);
$$;

-- Everything the app shows, in one call. Pass the last version to get {"unchanged": true}.
create or replace function public.app_catalog(p_version text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; ver text;
begin
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(r.payload order by r.sort_key, r.id) from app_private.catalog_rows() r), '[]'::jsonb),
    'banners', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'position', b.position, 'eyebrow', b.eyebrow, 'title', b.title,
               'subtitle', b.subtitle, 'image_url', b.image_url, 'product_id', b.product_id, 'link_type', b.link_type,
               'link_value', b.link_value, 'starts_at', b.starts_at, 'ends_at', b.ends_at) order by b.position)
      from public.app_banners b
      where b.active and (b.starts_at is null or b.starts_at <= now()) and (b.ends_at is null or b.ends_at > now())), '[]'::jsonb),
    'settings', jsonb_build_object('delivery_fee', s.delivery_fee, 'store_phone', s.store_phone, 'whatsapp', s.whatsapp,
                                   'price_round_to', s.price_round_to),
    'fx', jsonb_build_object('rate', app_private.fx(),
                             'source', case when s.usd_iqd_rate is not null then 'manual' else s.fx_source end,
                             'as_of', case when s.usd_iqd_rate is null then s.fx_as_of end),
    'synced_at', s.catalog_synced_at)
  into v
  from public.app_settings s where s.id = 1;
  ver := md5(v::text);
  if p_version is not null and p_version = ver then
    return jsonb_build_object('version', ver, 'unchanged', true);
  end if;
  return v || jsonb_build_object('version', ver);
end $$;
revoke all on function public.app_catalog(text) from public;
grant execute on function public.app_catalog(text) to anon, authenticated;

-- One order line priced by the server: the product (or its colour) as the catalog shows it now.
create or replace function app_private.catalog_line(p_id text, p_color text)
returns table (name text, zoho_id text, price integer, stock integer, has_colors boolean, color_found boolean)
language sql stable security definer set search_path = '' as $$
  select r.name,
         coalesce(cc.c->>'zohoId', r.zoho_id),
         coalesce((cc.c->>'price')::integer, r.price),
         coalesce((cc.c->>'stock')::integer, r.stock),
         jsonb_array_length(r.colors) > 0,
         cc.c is not null
  from app_private.catalog_rows() r
  left join lateral (
    select x as c from jsonb_array_elements(r.colors) x where p_color is not null and x->>'key' = p_color limit 1
  ) cc on true
  where r.id = p_id;
$$;

-- ── Placing an order: priced by the server ─────────────────────────────────────
-- Errors the app handles (message; detail = the product id where it applies):
--   sign_in_required, bad_request, too_many_orders, product_unavailable, out_of_stock, price_changed
create or replace function public.place_app_order(p_order jsonb, p_items jsonb)
returns public.app_orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_type  text := coalesce(nullif(p_order->>'type', ''), 'delivery');
  v_pay   text;
  v_name  text := nullif(btrim(p_order->>'receiver_name'), '');
  v_phone text := nullif(btrim(p_order->>'receiver_phone'), '');
  v_note  text := nullif(btrim(p_order->>'note'), '');
  v_ref   uuid;
  v_row   public.app_orders;
  v_fee   integer;
  v_sub   integer := 0;
  v_it    jsonb;
  v_pid   text; v_color text; v_qty integer; v_want integer;
  v_line  record;
  v_lines jsonb := '[]'::jsonb;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'sign_in_required' using errcode = 'P0001';
  end if;
  begin
    v_ref := nullif(p_order->>'client_ref', '')::uuid;
  exception when others then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'client_ref';
  end;
  -- A retry of a checkout that already went through returns the same order.
  if v_ref is not null then
    select * into v_row from public.app_orders o where o.customer_id = v_uid and o.client_ref = v_ref;
    if found then return v_row; end if;
  end if;

  if v_type not in ('delivery','pickup') then raise exception 'bad_request' using errcode = 'P0001', detail = 'type'; end if;
  v_pay := coalesce(nullif(p_order->>'pay', ''), case when v_type = 'pickup' then 'store' else 'cod' end);
  if v_pay not in ('cod','store') then raise exception 'bad_request' using errcode = 'P0001', detail = 'pay'; end if;
  if v_name is null or char_length(v_name) > 80 then raise exception 'bad_request' using errcode = 'P0001', detail = 'receiver_name'; end if;
  if v_phone is null or v_phone !~ '^\+964[0-9]{10}$' then raise exception 'bad_request' using errcode = 'P0001', detail = 'receiver_phone'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'bad_request' using errcode = 'P0001', detail = 'note'; end if;
  if v_type = 'delivery' and jsonb_typeof(p_order->'address') is distinct from 'object' then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'address';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'items';
  end if;
  if (select count(*) from public.app_orders o where o.customer_id = v_uid and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_orders' using errcode = 'P0001';
  end if;

  -- The profile is created from the sign-up details when the app has not saved it yet.
  insert into public.app_customers (id, name, phone)
  select u.id,
         left(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), 80),
         case when u.raw_user_meta_data->>'phone' ~ '^\+964[0-9]{10}$' then u.raw_user_meta_data->>'phone' end
  from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_pid := v_it->>'product_id';
    v_color := coalesce(nullif(v_it->>'color', ''), nullif(v_it->'options'->>'color', ''));
    begin
      v_qty := (v_it->>'qty')::integer;
      v_want := nullif(v_it->>'unit_price', '')::integer;
    exception when others then
      raise exception 'bad_request' using errcode = 'P0001', detail = coalesce(v_pid, 'item');
    end;
    if v_pid is null or v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'bad_request' using errcode = 'P0001', detail = coalesce(v_pid, 'item');
    end if;
    select * into v_line from app_private.catalog_line(v_pid, v_color);
    if not found or v_line.price is null or (v_line.has_colors and v_color is not null and not v_line.color_found) then
      raise exception 'product_unavailable' using errcode = 'P0001', detail = v_pid;
    end if;
    if v_line.stock < v_qty then
      raise exception 'out_of_stock' using errcode = 'P0001', detail = v_pid;
    end if;
    if v_want is not null and v_want <> v_line.price then
      raise exception 'price_changed' using errcode = 'P0001', detail = v_pid;
    end if;
    v_sub := v_sub + v_qty * v_line.price;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_pid, 'zoho_id', v_line.zoho_id, 'name', v_line.name, 'qty', v_qty, 'unit_price', v_line.price,
      'options', case when jsonb_typeof(v_it->'options') = 'object' then v_it->'options' else '{}'::jsonb end
                 || case when v_color is not null then jsonb_build_object('color', v_color) else '{}'::jsonb end));
  end loop;

  select case when v_type = 'pickup' then 0 else s.delivery_fee end into v_fee from public.app_settings s where s.id = 1;
  v_fee := coalesce(v_fee, 5000);

  insert into public.app_orders (customer_id, type, status, city, branch, address, receiver_name, receiver_phone,
                                 note, slot, pay, subtotal, discount, delivery_fee, total, client_ref)
  values (v_uid, v_type, 'placed', coalesce(nullif(p_order->>'city', ''), 'erbil'),
          case when v_type = 'pickup' then coalesce(nullif(p_order->>'branch', ''), 'muzaffariya') end,
          case when v_type = 'delivery' then p_order->'address' end,
          v_name, v_phone, v_note,
          case when jsonb_typeof(p_order->'slot') = 'object' then p_order->'slot' end,
          v_pay, v_sub, 0, v_fee, v_sub + v_fee, v_ref)
  returning * into v_row;

  insert into public.app_order_items (order_id, product_id, zoho_id, name, qty, unit_price, options)
  select v_row.id, l->>'product_id', l->>'zoho_id', l->>'name', (l->>'qty')::integer, (l->>'unit_price')::integer, l->'options'
  from jsonb_array_elements(v_lines) l;

  return v_row;
end $$;
revoke all on function public.place_app_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_app_order(jsonb, jsonb) to authenticated;

-- ── Deleting an account (App Store and Google Play require it in the app) ──────
-- Orders on their way (packed, out for delivery, ready for pickup) must finish first. Orders
-- not yet packed are cancelled. Past orders stay for the store's records without the name,
-- phone, address or note, and the sign-in itself is deleted.
create or replace function public.delete_my_app_account()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'sign_in_required' using errcode = 'P0001'; end if;
  if public.is_admin() then raise exception 'admin_account' using errcode = 'P0001'; end if;
  if exists (select 1 from public.app_orders o
             where o.customer_id = v_uid and o.special is null and o.status in ('packed','out','ready')) then
    raise exception 'order_in_progress' using errcode = 'P0001';
  end if;
  update public.app_orders set special = 'cancelled', cancelled_by = 'you'
   where customer_id = v_uid and special is null and status in ('placed','confirmed');
  update public.app_orders
     set customer_id = null, receiver_name = 'Deleted account', receiver_phone = '', address = null, note = null
   where customer_id = v_uid;
  delete from public.app_customers where id = v_uid;
  delete from auth.users where id = v_uid;
end $$;
revoke all on function public.delete_my_app_account() from public, anon;
grant execute on function public.delete_my_app_account() to authenticated;

-- ── Private functions stay private ─────────────────────────────────────────────
revoke all on all functions in schema app_private from public, anon, authenticated;
revoke all on all tables in schema app_private from public, anon, authenticated;

-- ── Every 10 minutes ───────────────────────────────────────────────────────────
select cron.unschedule(jobid) from cron.job where jobname = 'app-catalog-sync';
select cron.schedule('app-catalog-sync', '*/10 * * * *', 'select public.app_sync_run()');

notify pgrst, 'reload schema';
