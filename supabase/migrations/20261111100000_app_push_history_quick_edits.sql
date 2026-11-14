-- ITland: push notifications, order history, quick product edits, and what the apps need for two-step sign-in.
-- Applies on top of 20261110150000_app_admin_in_app.sql. Safe to run again.
--
-- 1. Push notifications
--    public.app_push_devices      one row per phone (APNs token on iOS, FCM token on Android) with its language.
--                                 Written only through register_app_push_device / unregister_app_push_device.
--    app_private.push_outbox      one row per (person, event). Filled by the trigger on app_orders.
--    app_private.push_texts       the words, in en / ar / ku (Kurdish from Gemini via agy, like the apps).
--    The edge function push-send (supabase/functions/push-send) claims the outbox with claim_app_push(),
--    sends through APNs / FCM and reports back with finish_app_push(). It is called through pg_net right
--    after an event (trigger on the outbox) and every minute by pg_cron for retries. Key: Vault
--    'app_push_key' (made here), checked by app_push_key_ok(); the job also sends the publishable key.
--
--    Customers hear about their own orders: confirmed, packed, out for delivery (with the handover code),
--    delivered, ready for pickup (with the pickup code), picked up, delayed (new time), delivery failed,
--    cancelled by the store / not paid in time, refunded, online payment received.
--    Admins hear about: a new order (cash / pay at store at once; FIB / card once paid), and a customer
--    cancelling.
--
-- 2. Order history: public.app_order_events (admins read). Every change to an order's status, problem,
--    courier, codes, note or payment, with who made it (admin email, the customer, or the system).
--
-- 3. Quick product edits from the app: admin_update_product(product, patch) for hidden, featured (Best
--    sellers), is_new, flash, stock_override, sale_price_iqd, sale_ends_at, restock_date.
--
-- 4. Two-step sign-in: app_private.is_listed_admin() = in admin_users with a confirmed email (what
--    is_admin() checks today). app_admin_me() also returns {listed, aal}, so the apps can ask a listed admin
--    for the authenticator code. 20261111110000_app_admin_mfa_required.sql then makes is_admin() require
--    aal2 (apply it only after the website's two-step login is deployed).

-- ── 0. Shared: who is a listed admin, overlays ───────────────────────────────
create or replace function app_private.is_listed_admin()
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
revoke all on function app_private.is_listed_admin() from public, anon;
grant execute on function app_private.is_listed_admin() to service_role;

create or replace function public.app_admin_me()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'admin', public.is_admin(),
    'owner', public.is_app_owner(),
    'listed', app_private.is_listed_admin(),
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'));
$$;
revoke all on function public.app_admin_me() from public, anon;
grant execute on function public.app_admin_me() to authenticated;

-- The overlay row a product's changes go into. A plain Zoho item ('z-<zoho id>') gets its light row first,
-- the same row the website dashboard makes. Returns the row's id; raises not_found.
create or replace function app_private.ensure_product_overlay(p_product_id text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id    text := btrim(coalesce(p_product_id, ''));
  v_zoho  text;
  v_order integer;
  v_other text;
begin
  if v_id = '' then raise exception 'bad_request' using errcode = 'P0001', detail = 'product'; end if;
  if exists (select 1 from public.app_products p where p.id = v_id) then return v_id; end if;
  if v_id !~ '^z-' then raise exception 'not_found' using errcode = 'P0001', detail = v_id; end if;
  v_zoho := substr(v_id, 3);
  select z.zoho_order into v_order from public.app_zoho_items z where z.zoho_id = v_zoho;
  if not found then raise exception 'not_found' using errcode = 'P0001', detail = v_id; end if;
  select p.id into v_other from public.app_products p where p.zoho_id = v_zoho;
  if v_other is not null then return v_other; end if;
  insert into public.app_products (id, zoho_id, sort) values (v_id, v_zoho, 100000 + coalesce(v_order, 0));
  return v_id;
end $$;
revoke all on function app_private.ensure_product_overlay(text) from public, anon, authenticated;

-- Same behaviour as before, now through ensure_product_overlay.
create or replace function public.admin_set_product_image(p_product_id text, p_image_url text, p_color text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id    text;
  v_url   text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_color text := nullif(btrim(coalesce(p_color, '')), '');
  v_row   public.app_products;
  v_n     integer;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_url is not null and v_url !~ '^(https://|asset:)' then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'image_url';
  end if;
  v_id := app_private.ensure_product_overlay(p_product_id);
  if v_color is null then
    update public.app_products p set image_url = v_url where p.id = v_id returning * into v_row;
  else
    update public.app_products p
       set colors = (
         select coalesce(jsonb_agg(
                  case when e.c->>'key' = v_color
                       then case when v_url is null then e.c - 'img' else e.c || jsonb_build_object('img', v_url) end
                       else e.c end
                  order by e.ord), '[]'::jsonb)
         from jsonb_array_elements(case when jsonb_typeof(p.colors) = 'array' then p.colors else '[]'::jsonb end)
              with ordinality as e(c, ord))
     where p.id = v_id
       and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p.colors) = 'array' then p.colors else '[]'::jsonb end) c
                   where c->>'key' = v_color)
    returning * into v_row;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'not_found' using errcode = 'P0001', detail = v_color; end if;
  end if;
  return jsonb_build_object('id', v_row.id, 'image_url', v_row.image_url, 'colors', v_row.colors);
end $$;
revoke all on function public.admin_set_product_image(text, text, text) from public, anon;
grant execute on function public.admin_set_product_image(text, text, text) to authenticated;

-- ── 3. Quick product edits ───────────────────────────────────────────────────
create or replace function public.admin_update_product(p_product_id text, p_patch jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id   text;
  v_row  public.app_products;
  v_key  text;
  v_bad  text;
  v_int  integer;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'patch';
  end if;
  select k into v_bad from jsonb_object_keys(p_patch) k
   where k not in ('hidden', 'featured', 'is_new', 'flash', 'stock_override', 'sale_price_iqd', 'sale_ends_at', 'restock_date')
   limit 1;
  if v_bad is not null then raise exception 'bad_request' using errcode = 'P0001', detail = v_bad; end if;
  foreach v_key in array array['hidden', 'featured', 'is_new', 'flash'] loop
    if p_patch ? v_key and jsonb_typeof(p_patch->v_key) <> 'boolean' then
      raise exception 'bad_request' using errcode = 'P0001', detail = v_key;
    end if;
  end loop;
  if p_patch ? 'stock_override' and jsonb_typeof(p_patch->'stock_override') not in ('number', 'null') then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'stock_override';
  end if;
  if jsonb_typeof(p_patch->'stock_override') = 'number' then
    v_int := (p_patch->>'stock_override')::numeric::integer;
    if v_int < 0 or v_int > 100000 then raise exception 'bad_request' using errcode = 'P0001', detail = 'stock_override'; end if;
  end if;
  if p_patch ? 'sale_price_iqd' and jsonb_typeof(p_patch->'sale_price_iqd') not in ('number', 'null') then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'sale_price_iqd';
  end if;
  if jsonb_typeof(p_patch->'sale_price_iqd') = 'number' and (p_patch->>'sale_price_iqd')::numeric <= 0 then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'sale_price_iqd';
  end if;
  begin
    perform (p_patch->>'sale_ends_at')::timestamptz, (p_patch->>'restock_date')::date;
  exception when others then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'date';
  end;

  v_id := app_private.ensure_product_overlay(p_product_id);
  update public.app_products p set
    hidden         = case when p_patch ? 'hidden'   then (p_patch->>'hidden')::boolean   else p.hidden end,
    featured       = case when p_patch ? 'featured' then (p_patch->>'featured')::boolean else p.featured end,
    is_new         = case when p_patch ? 'is_new'   then (p_patch->>'is_new')::boolean   else p.is_new end,
    flash          = case when p_patch ? 'flash'    then (p_patch->>'flash')::boolean    else p.flash end,
    stock_override = case when p_patch ? 'stock_override' then (p_patch->>'stock_override')::numeric::integer else p.stock_override end,
    sale_price_iqd = case when p_patch ? 'sale_price_iqd' then (p_patch->>'sale_price_iqd')::numeric::integer else p.sale_price_iqd end,
    sale_ends_at   = case when p_patch ? 'sale_ends_at'   then (p_patch->>'sale_ends_at')::timestamptz else p.sale_ends_at end,
    restock_date   = case when p_patch ? 'restock_date'   then (p_patch->>'restock_date')::date else p.restock_date end
  where p.id = v_id
  returning * into v_row;
  return to_jsonb(v_row);
end $$;
revoke all on function public.admin_update_product(text, jsonb) from public, anon;
grant execute on function public.admin_update_product(text, jsonb) to authenticated;

-- ── 2. Order history ─────────────────────────────────────────────────────────
create table if not exists public.app_order_events (
  id          bigserial primary key,
  order_id    text not null references public.app_orders(id) on delete cascade,
  at          timestamptz not null default now(),
  actor       text not null check (actor in ('admin', 'customer', 'system')),
  actor_email text,
  changes     jsonb not null
);
create index if not exists app_order_events_order_idx on public.app_order_events (order_id, at);
alter table public.app_order_events enable row level security;
revoke all on public.app_order_events from anon, authenticated;
grant select on public.app_order_events to authenticated;
drop policy if exists "admins read order events" on public.app_order_events;
create policy "admins read order events" on public.app_order_events for select to authenticated
  using ((select public.is_admin()));

create or replace function app_private.log_order_event()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_actor   text;
  v_uid     uuid := auth.uid();
  v_old     jsonb;
  v_new     jsonb;
  f         text;
begin
  if tg_op = 'INSERT' then
    v_changes := jsonb_build_object('status', jsonb_build_array(null, new.status));
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    foreach f in array array['status', 'special', 'cancelled_by', 'new_eta', 'courier_name', 'courier_phone',
                             'handover_code', 'pickup_code', 'admin_note', 'payment_status'] loop
      if (v_old->f) is distinct from (v_new->f) then
        v_changes := v_changes || jsonb_build_object(f, jsonb_build_array(v_old->f, v_new->f));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return null; end if;
  end if;
  v_actor := case
    when v_uid is null then 'system'
    when v_uid = new.customer_id or (tg_op = 'UPDATE' and v_uid = old.customer_id) then 'customer'
    when app_private.is_listed_admin() then 'admin'
    else 'system' end;
  insert into public.app_order_events (order_id, actor, actor_email, changes)
  values (new.id, v_actor, case when v_actor = 'admin' then lower(auth.jwt()->>'email') end, v_changes);
  return null;
end $$;
revoke all on function app_private.log_order_event() from public, anon, authenticated;

drop trigger if exists app_orders_log_event on public.app_orders;
create trigger app_orders_log_event after insert or update on public.app_orders
  for each row execute function app_private.log_order_event();

-- ── 1. Push notifications ────────────────────────────────────────────────────
create table if not exists public.app_push_devices (
  token        text primary key check (char_length(token) between 16 and 4096),
  user_id      uuid not null references auth.users(id) on delete cascade,
  platform     text not null check (platform in ('ios', 'android')),
  provider     text not null check (provider in ('apns', 'fcm')),
  apns_env     text check (apns_env in ('sandbox', 'production')),
  language     text not null default 'ku' check (language in ('ku', 'ar', 'en')),
  app_version  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists app_push_devices_user_idx on public.app_push_devices (user_id);
alter table public.app_push_devices enable row level security;
revoke all on public.app_push_devices from anon, authenticated;

-- The phone tells the server its token after sign-in, on launch and when the language changes. A token
-- that was another account's (shared phone) moves to this one.
create or replace function public.register_app_push_device(
  p_token text, p_platform text, p_language text default 'ku', p_env text default null, p_app_version text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := btrim(coalesce(p_token, ''));
  v_platform text := lower(coalesce(p_platform, ''));
  v_lang text := case when p_language in ('ku', 'ar', 'en') then p_language else 'ku' end;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'sign_in_required' using errcode = 'P0001';
  end if;
  if char_length(v_token) not between 16 and 4096 then raise exception 'bad_request' using errcode = 'P0001', detail = 'token'; end if;
  if v_platform not in ('ios', 'android') then raise exception 'bad_request' using errcode = 'P0001', detail = 'platform'; end if;
  if (select count(*) from public.app_push_devices d where d.user_id = v_uid and d.token <> v_token) >= 10 then
    delete from public.app_push_devices d
     where d.token = (select d2.token from public.app_push_devices d2 where d2.user_id = v_uid order by d2.last_seen_at limit 1);
  end if;
  insert into public.app_push_devices (token, user_id, platform, provider, apns_env, language, app_version)
  values (v_token, v_uid, v_platform, case when v_platform = 'ios' then 'apns' else 'fcm' end,
          case when v_platform = 'ios' then coalesce(nullif(p_env, ''), 'production') end, v_lang, left(p_app_version, 32))
  on conflict (token) do update set
    user_id = excluded.user_id, platform = excluded.platform, provider = excluded.provider,
    apns_env = excluded.apns_env, language = excluded.language, app_version = excluded.app_version,
    last_seen_at = now();
end $$;
revoke all on function public.register_app_push_device(text, text, text, text, text) from public, anon;
grant execute on function public.register_app_push_device(text, text, text, text, text) to authenticated;

-- Sign out on this phone: it stops getting this account's notifications.
create or replace function public.unregister_app_push_device(p_token text)
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.app_push_devices d where d.token = btrim(coalesce(p_token, '')) and d.user_id = auth.uid();
$$;
revoke all on function public.unregister_app_push_device(text) from public, anon;
grant execute on function public.unregister_app_push_device(text) to authenticated;

create table if not exists app_private.push_texts (
  key text primary key,
  en  text not null,
  ar  text not null,
  ku  text not null
);
alter table app_private.push_texts enable row level security;

create table if not exists app_private.push_outbox (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  order_id    text,
  vars        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  next_try_at timestamptz not null default now(),
  attempts    integer not null default 0,
  claimed_at  timestamptz,
  sent_at     timestamptz,
  last_error  text
);
create index if not exists push_outbox_pending_idx on app_private.push_outbox (next_try_at) where sent_at is null;
alter table app_private.push_outbox enable row level security;

-- {name} placeholders → values.
create or replace function app_private.push_fill(p_text text, p_vars jsonb)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare r record; v text := coalesce(p_text, '');
begin
  for r in select key, value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    v := replace(v, '{' || r.key || '}', coalesce(r.value, ''));
  end loop;
  return v;
end $$;

create or replace function app_private.push_text(p_key text, p_lang text)
returns text
language sql stable
set search_path = ''
as $$
  select case p_lang when 'ar' then t.ar when 'en' then t.en else t.ku end
  from app_private.push_texts t where t.key = p_key;
$$;

-- `25,000 IQD` / `25,000 د.ع`.
create or replace function app_private.push_money(p_amount integer, p_lang text)
returns text
language sql immutable
set search_path = ''
as $$
  select to_char(coalesce(p_amount, 0), 'FM999,999,999,990') || case when p_lang = 'en' then ' IQD' else ' د.ع' end;
$$;

-- Queue one event for one person.
create or replace function app_private.queue_push(p_user uuid, p_kind text, p_order text, p_vars jsonb)
returns void
language sql security definer
set search_path = ''
as $$
  insert into app_private.push_outbox (user_id, kind, order_id, vars)
  select p_user, p_kind, p_order, coalesce(p_vars, '{}'::jsonb)
  where p_user is not null and exists (select 1 from public.app_push_devices d where d.user_id = p_user);
$$;

-- Queue one event for every admin with an account and a phone.
create or replace function app_private.queue_admin_push(p_kind text, p_order text, p_vars jsonb)
returns void
language sql security definer
set search_path = ''
as $$
  insert into app_private.push_outbox (user_id, kind, order_id, vars)
  select distinct u.id, p_kind, p_order, coalesce(p_vars, '{}'::jsonb)
  from public.admin_users a
  join auth.users u on lower(u.email) = lower(a.email) and u.email_confirmed_at is not null
  where exists (select 1 from public.app_push_devices d where d.user_id = u.id);
$$;

create or replace function app_private.queue_order_push()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_vars  jsonb;
  v_name  text;
  v_items integer;
  v_kind  text;
begin
  select coalesce(nullif(c.name, ''), new.receiver_name) into v_name from public.app_customers c where c.id = new.customer_id;
  v_name := coalesce(v_name, new.receiver_name, '');
  select coalesce(sum(i.qty), 0)::integer into v_items from public.app_order_items i where i.order_id = new.id;
  v_vars := jsonb_build_object(
    'id', new.id, 'name', v_name, 'total', new.total, 'type', new.type, 'city', new.city, 'pay', new.pay,
    'items', v_items, 'code', case when new.type = 'pickup' then new.pickup_code else new.handover_code end,
    'eta', coalesce(new.new_eta, ''));

  if tg_op = 'INSERT' then
    -- Cash and pay-at-store orders are real at once; FIB / card ones once paid (below).
    if new.pay in ('cod', 'store') then perform app_private.queue_admin_push('admin.new', new.id, v_vars); end if;
    return null;
  end if;

  -- Paid online.
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' and new.pay in ('fib', 'card') then
    perform app_private.queue_push(new.customer_id, 'order.paid', new.id, v_vars);
    if new.special is null then perform app_private.queue_admin_push('admin.paid', new.id, v_vars); end if;
  end if;

  -- The next step (while the order is open).
  if new.status is distinct from old.status and coalesce(new.special, 'delayed') = 'delayed'
     and new.status in ('confirmed', 'packed', 'out', 'delivered', 'ready', 'picked') then
    perform app_private.queue_push(new.customer_id, 'order.' || new.status, new.id, v_vars);
  end if;

  -- Problems.
  if new.special is distinct from old.special and new.special is not null then
    v_kind := case new.special
      when 'delayed' then 'order.delayed'
      when 'failed' then 'order.failed'
      when 'refunded' then 'order.refunded'
      when 'cancelled' then case new.cancelled_by when 'store' then 'order.cancelled.store'
                                                  when 'unpaid' then 'order.cancelled.unpaid' end
    end;
    if v_kind is not null then perform app_private.queue_push(new.customer_id, v_kind, new.id, v_vars); end if;
    if new.special = 'cancelled' and new.cancelled_by = 'you' then
      perform app_private.queue_admin_push('admin.cancelled', new.id, v_vars);
    end if;
  elsif new.special = 'delayed' and new.new_eta is distinct from old.new_eta and new.new_eta is not null then
    perform app_private.queue_push(new.customer_id, 'order.delayed', new.id, v_vars);
  end if;
  return null;
end $$;
revoke all on function app_private.queue_order_push() from public, anon, authenticated;

drop trigger if exists app_orders_queue_push on public.app_orders;
-- Deferred to the end of the transaction, so place_app_order's items are in when a new order is counted.
create constraint trigger app_orders_queue_push after insert or update on public.app_orders
  deferrable initially deferred
  for each row execute function app_private.queue_order_push();

-- The edge function's key, made inside the database (never leaves it).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'app_push_key') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'app_push_key',
      'Checked by the push-send edge function (x-push-key)');
  end if;
end $$;

create or replace function public.app_push_key_ok(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_key) >= 24 and p_key = (
    select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'app_push_key'), false);
$$;
revoke all on function public.app_push_key_ok(text) from public, anon, authenticated;
grant execute on function public.app_push_key_ok(text) to service_role;

-- Claims up to p_limit pending events and returns one message per phone, in that phone's language.
create or replace function public.claim_app_push(p_limit integer default 50)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_ids bigint[]; v_out jsonb;
begin
  with c as (
    select o.id from app_private.push_outbox o
     where o.sent_at is null and o.next_try_at <= now() and o.attempts < 6
       and (o.claimed_at is null or o.claimed_at < now() - interval '2 minutes')
     order by o.id
     limit greatest(1, least(coalesce(p_limit, 50), 200))
     for update skip locked),
  u as (
    update app_private.push_outbox o set claimed_at = now(), attempts = o.attempts + 1
      from c where o.id = c.id
    returning o.id)
  select array_agg(u.id) into v_ids from u;
  if v_ids is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(m), '[]'::jsonb) into v_out from (
    select jsonb_build_object(
      'outbox_id', o.id, 'token', d.token, 'provider', d.provider, 'apns_env', d.apns_env, 'kind', o.kind,
      'title', app_private.push_fill(app_private.push_text(o.kind || '.title', d.language), v),
      'body',  app_private.push_fill(app_private.push_text(o.kind || '.body', d.language), v),
      'url', case when o.kind like 'admin.%' then 'itland://admin/order/' || o.order_id else 'itland://order/' || o.order_id end,
      'order_id', o.order_id) as m
    from app_private.push_outbox o
    join public.app_push_devices d on d.user_id = o.user_id
    cross join lateral (
      select o.vars || jsonb_build_object(
        'total', app_private.push_money((o.vars->>'total')::integer, d.language),
        'amount', app_private.push_money((o.vars->>'total')::integer, d.language),
        'place', case when o.vars->>'type' = 'pickup' then app_private.push_text('place.pickup', d.language)
                      else coalesce(app_private.push_text('city.' || (o.vars->>'city'), d.language), initcap(o.vars->>'city')) end,
        'method', coalesce(app_private.push_text('pay.' || (o.vars->>'pay'), d.language), o.vars->>'pay')) as v
    ) x
    where o.id = any(v_ids)
      and app_private.push_text(o.kind || '.title', d.language) is not null
  ) s;
  -- Events whose person has no phone any more are done.
  update app_private.push_outbox o set sent_at = now(), last_error = 'no device'
   where o.id = any(v_ids) and not exists (select 1 from public.app_push_devices d where d.user_id = o.user_id);
  return v_out;
end $$;
revoke all on function public.claim_app_push(integer) from public, anon, authenticated;
grant execute on function public.claim_app_push(integer) to service_role;

-- p_sent: outbox ids delivered to at least one phone. p_retry: ids to try again later. p_dead: tokens that
-- APNs / FCM say are gone (app deleted, token rotated).
create or replace function public.finish_app_push(p_sent bigint[], p_retry bigint[], p_dead text[], p_error text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update app_private.push_outbox set sent_at = now(), last_error = null where id = any(coalesce(p_sent, '{}'));
  update app_private.push_outbox o
     set claimed_at = null, last_error = left(p_error, 500),
         next_try_at = now() + make_interval(secs => least(3600, 30 * power(2, o.attempts)::integer))
   where o.id = any(coalesce(p_retry, '{}')) and o.sent_at is null;
  update app_private.push_outbox o set sent_at = now(), last_error = coalesce(left(p_error, 500), 'gave up')
   where o.id = any(coalesce(p_retry, '{}')) and o.attempts >= 6;
  delete from public.app_push_devices where token = any(coalesce(p_dead, '{}'));
  delete from app_private.push_outbox where sent_at < now() - interval '30 days';
end $$;
revoke all on function public.finish_app_push(bigint[], bigint[], text[], text) from public, anon, authenticated;
grant execute on function public.finish_app_push(bigint[], bigint[], text[], text) to service_role;

-- Calls push-send (right after events, and every minute for retries).
create or replace function app_private.invoke_push()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_key text; v_url text; v_pk text; v_headers jsonb;
begin
  if not exists (select 1 from app_private.push_outbox o where o.sent_at is null and o.next_try_at <= now() and o.attempts < 6) then
    return;
  end if;
  select value into v_url from app_private.config where key = 'functions_url';
  select value into v_pk from app_private.config where key = 'publishable_key';
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'app_push_key';
  exception when others then v_key := null;
  end;
  if v_key is null or v_url is null then return; end if;
  v_headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-key', v_key);
  if v_pk is not null then v_headers := v_headers || jsonb_build_object('apikey', v_pk, 'Authorization', 'Bearer ' || v_pk); end if;
  perform net.http_post(url := v_url || '/push-send', headers := v_headers, body := '{}'::jsonb, timeout_milliseconds := 30000);
end $$;
revoke all on function app_private.invoke_push() from public, anon, authenticated;

create or replace function app_private.push_outbox_kick()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.invoke_push();
  return null;
end $$;
revoke all on function app_private.push_outbox_kick() from public, anon, authenticated;
drop trigger if exists push_outbox_kick on app_private.push_outbox;
create trigger push_outbox_kick after insert on app_private.push_outbox
  for each statement execute function app_private.push_outbox_kick();

select cron.unschedule(jobid) from cron.job where jobname = 'app-push-retry';
select cron.schedule('app-push-retry', '* * * * *', 'select app_private.invoke_push()');

-- The words (en / ar / ku). {id} order number, {code} handover / pickup code, {eta} new time, {total} /
-- {amount} money, {name} customer, {place} city or "Store pickup", {method} FIB / Visa / Mastercard.
insert into app_private.push_texts (key, en, ar, ku) values
  ('order.confirmed.title', 'Order confirmed', 'تم تأكيد الطلب', 'داواکاری پەسەندکرا'),
  ('order.confirmed.body', '{id}: we''re preparing your items.', '{id}: نجهّز منتجاتك الآن.', '{id}: خەریکین کاڵاکانت ئامادە دەکەین.'),
  ('order.packed.title', 'Order packed', 'تم تغليف الطلب', 'داواکاری پێچراوەتەوە'),
  ('order.packed.body', '{id} is packed and will go out soon.', 'تم تغليف {id} وسيخرج قريبًا.', '{id} پێچراوەتەوە و بەم زووانە بەڕێ دەکەوێت.'),
  ('order.out.title', 'On its way', 'في الطريق إليك', 'لە ڕێگادایە'),
  ('order.out.body', '{id} is out for delivery. Give the courier your code {code}.', 'خرج {id} للتوصيل. أعطِ المندوب رمزك {code}.', '{id} لە ڕێگای گەیاندندایە. کۆدی {code} بدە بە گەیەنەرەکە.'),
  ('order.delivered.title', 'Delivered', 'تم التوصيل', 'گەیەندرا'),
  ('order.delivered.body', '{id} was delivered. Thank you for shopping at ITland!', 'تم توصيل {id}. شكرًا لتسوّقك من ITland!', '{id} گەیەندرا. سوپاس بۆ کڕینەکەت لە ITland!'),
  ('order.ready.title', 'Ready for pickup', 'جاهز للاستلام', 'ئامادەیە بۆ وەرگرتن'),
  ('order.ready.body', '{id} is ready at the store. Show code {code} at the counter.', '{id} جاهز في المتجر. أظهر الرمز {code} عند المكتب.', '{id} لە فرۆشگا ئامادەیە. لە کاونتەر کۆدی {code} پێشان بدە.'),
  ('order.picked.title', 'Picked up', 'تم الاستلام', 'وەرگیرا'),
  ('order.picked.body', 'You picked up {id}. Thank you for shopping at ITland!', 'استلمت {id}. شكرًا لتسوّقك من ITland!', '{id}ت وەرگرت. سوپاس بۆ کڕینەکەت لە ITland!'),
  ('order.delayed.title', 'Order delayed', 'تأخّر الطلب', 'داواکاری دواکەوت'),
  ('order.delayed.body', '{id} is running late. New time: {eta}.', '{id} متأخر. الموعد الجديد: {eta}.', '{id} کەمێک دواکەوتووە. کاتی نوێ: {eta}.'),
  ('order.failed.title', 'Delivery attempt failed', 'تعذّر التوصيل', 'هەوڵی گەیاندن سەرکەوتوو نەبوو'),
  ('order.failed.body', 'We couldn''t deliver {id}. We''ll contact you to arrange a new time.', 'لم نتمكن من توصيل {id}. سنتواصل معك لتحديد موعد جديد.', 'نەمانتوانی {id} بگەیەنین. پەیوەندیت پێوە دەکەین بۆ دیاریکردنی کاتێکی نوێ.'),
  ('order.cancelled.store.title', 'Order cancelled', 'تم إلغاء الطلب', 'داواکاری هەڵوەشێنرایەوە'),
  ('order.cancelled.store.body', 'ITland cancelled {id}. Message us on WhatsApp if you have questions.', 'ألغى ITland الطلب {id}. راسلنا على واتساب إن كانت لديك أسئلة.', 'ITland داواکاریی {id}ی هەڵوەشاندەوە. ئەگەر پرسیارت هەیە لە WhatsApp نامەمان بۆ بنێرە.'),
  ('order.cancelled.unpaid.title', 'Order cancelled', 'تم إلغاء الطلب', 'داواکاری هەڵوەشێنرایەوە'),
  ('order.cancelled.unpaid.body', '{id} was cancelled because the payment didn''t arrive in time.', 'أُلغي {id} لأن الدفعة لم تصل في الوقت المحدد.', '{id} هەڵوەشێنرایەوە چونکە پارەدانەکە لە کاتی خۆیدا نەگەیشت.'),
  ('order.refunded.title', 'Refund made', 'تم الاسترداد', 'پارەکە گەڕێندرایەوە'),
  ('order.refunded.body', '{amount} for {id} has been refunded.', 'تم استرداد {amount} للطلب {id}.', 'بڕی {amount} بۆ {id} گەڕێندرایەوە.'),
  ('order.paid.title', 'Payment received', 'تم استلام الدفعة', 'پارەدان گەیشت'),
  ('order.paid.body', 'We received {amount} for {id}.', 'استلمنا {amount} للطلب {id}.', 'بڕی {amount}مان بۆ {id} پێگەیشت.'),
  ('admin.new.title', 'New order {id}', 'طلب جديد {id}', 'داواکاریی نوێ {id}'),
  ('admin.new.body', '{name} · {total} · {place}', '{name} · {total} · {place}', '{name} · {total} · {place}'),
  ('admin.paid.title', 'New paid order {id}', 'طلب جديد مدفوع {id}', 'داواکاریی نوێی پارەدراو {id}'),
  ('admin.paid.body', '{name} paid {total} by {method} · {place}', 'دفع {name} مبلغ {total} عبر {method} · {place}', '{name} بڕی {total}ی دا لە ڕێگەی {method} · {place}'),
  ('admin.cancelled.title', 'Order cancelled by customer', 'ألغى العميل الطلب', 'داواکاری لەلایەن کڕیارەوە هەڵوەشێنرایەوە'),
  ('admin.cancelled.body', '{name} cancelled {id} ({total}).', 'ألغى {name} الطلب {id} ({total}).', '{name} داواکاریی {id}ی هەڵوەشاندەوە ({total}).'),
  ('place.pickup', 'Store pickup', 'استلام من المتجر', 'وەرگرتن لە فرۆشگا'),
  ('city.baghdad', 'Baghdad', 'بغداد', 'بەغدا'),
  ('city.duhok', 'Duhok', 'دهوك', 'دهۆک'),
  ('city.erbil', 'Erbil', 'أربيل', 'هەولێر'),
  ('city.halabja', 'Halabja', 'حلبجة', 'هەڵەبجە'),
  ('city.kirkuk', 'Kirkuk', 'كركوك', 'کەرکووک'),
  ('city.koya', 'Koya', 'كويه', 'کۆیە'),
  ('city.mosul', 'Mosul', 'الموصل', 'مووسڵ'),
  ('city.soran', 'Soran', 'سوران', 'سۆران'),
  ('city.sulaymaniyah', 'Sulaymaniyah', 'السليمانية', 'سلێمانی'),
  ('city.zakho', 'Zakho', 'زاخو', 'زاخۆ'),
  ('pay.card', 'Visa / Mastercard', 'فيزا / ماستركارد', 'Visa / Mastercard'),
  ('pay.cod', 'Cash on delivery', 'الدفع عند الاستلام', 'پارەدان لەکاتی وەرگرتن'),
  ('pay.fib', 'FIB', 'FIB', 'FIB'),
  ('pay.store', 'Pay at store', 'الدفع في المتجر', 'پارەدان لە فرۆشگا')
on conflict (key) do update set en = excluded.en, ar = excluded.ar, ku = excluded.ku;

notify pgrst, 'reload schema';
