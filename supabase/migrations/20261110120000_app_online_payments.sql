-- Online payments for app orders: FIB (First Iraqi Bank app / QR) and card (FIB's card gateway).
-- Applies on top of 20261108210000_app_catalog_brand_and_admin_delete.sql.
--
-- Same design as the Tawaf project's shop payments (Tawaf app/supabase/patches_shop_payments*.sql,
-- migrations/20260914000000_shop_card_payments.sql, 20261005083251_fib_shop_checkout_claim.sql):
--
-- * The order decides its gateway when it is placed (`pay` = fib | card) and is placed UNPAID.
--   cod and store orders are unchanged.
-- * Every attempt to pay an order is one row in app_payments. The app never writes it: the
--   app-payment-start edge function opens it through start_app_payment() (runs as the customer,
--   so ownership and the amount are the database's decision), then talks to FIB with credentials
--   that live only in Edge Function secrets.
-- * An order becomes paid in exactly one place, record_app_payment_success(), which only the
--   service role may call, and only after the edge function asked FIB itself (a callback body is
--   a hint, never the outcome).
-- * An unpaid FIB / card order cannot move past "placed" (trigger below), and one that is still
--   unpaid when its time to pay is over is cancelled (cancelled_by = 'unpaid').
-- * The dashboard switches each method on (app_settings.fib_enabled / card_enabled, both off by
--   default); the apps read them from app_catalog().settings.payments and offer only what is on.
--
-- After applying: set the Edge Function secrets and deploy the functions (BACKEND.md "Online
-- payments"), then add the reconcile worker's key to Vault (see app_private.invoke_payment_checks).

-- ── Switches (dashboard) ─────────────────────────────────────────────────────
alter table public.app_settings
  add column if not exists fib_enabled  boolean not null default false,
  add column if not exists card_enabled boolean not null default false,
  -- Minutes a customer has to pay an FIB / card order before it is cancelled.
  add column if not exists pay_window_minutes integer not null default 60
    check (pay_window_minutes between 15 and 1440);

-- ── The order's own payment state ───────────────────────────────────────────
alter table public.app_orders
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at        timestamptz,
  add column if not exists pay_by         timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.app_orders'::regclass
                  and conname = 'app_orders_pay_check') then
    alter table public.app_orders add constraint app_orders_pay_check
      check (pay in ('cod', 'store', 'fib', 'card'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.app_orders'::regclass
                  and conname = 'app_orders_payment_status_check') then
    alter table public.app_orders add constraint app_orders_payment_status_check
      check (payment_status in ('unpaid', 'paid', 'refunded'));
  end if;
end $$;

-- 'unpaid': the order was cancelled because its online payment never arrived.
alter table public.app_orders drop constraint if exists app_orders_cancelled_by_check;
alter table public.app_orders add constraint app_orders_cancelled_by_check
  check (cancelled_by in ('you', 'store', 'unpaid'));

-- Cash orders that were already delivered or picked up were paid at the door / counter.
update public.app_orders set payment_status = 'paid', paid_at = coalesce(paid_at, updated_at)
 where pay in ('cod', 'store') and status in ('delivered', 'picked') and special is null
   and payment_status = 'unpaid';

-- ── Attempts to pay an order online ─────────────────────────────────────────
create table if not exists public.app_payments (
  id                           uuid primary key default gen_random_uuid(),
  order_id                     text not null references public.app_orders(id) on delete cascade,
  customer_id                  uuid,
  amount_iqd                   integer not null check (amount_iqd > 0),
  method                       text not null check (method in ('fib', 'card')),
  status                       text not null default 'initiated'
    check (status in ('initiated', 'succeeded', 'failed', 'expired', 'cancelled')),
  provider_reference           text,          -- FIB paymentId (both gateways)
  provider_expires_at          timestamptz,   -- FIB validUntil; our own 30-minute window for card
  provider_payload             jsonb not null default '{}'::jsonb,  -- QR / code / links, or the card redirect
  provider_creation_started_at timestamptz,
  provider_terminal_at         timestamptz,   -- FIB gave a final answer (or the attempt never reached FIB)
  provider_next_check_at       timestamptz,
  idempotency_key              text,
  failure_reason               text,
  created_at                   timestamptz not null default now(),
  confirmed_at                 timestamptz
);
create index if not exists app_payments_order_idx on public.app_payments (order_id, created_at desc);
create index if not exists app_payments_customer_idx on public.app_payments (customer_id, created_at desc);
create unique index if not exists app_payments_provider_reference_idx
  on public.app_payments (method, provider_reference) where provider_reference is not null;
create index if not exists app_payments_card_order_idx
  on public.app_payments ((provider_payload->>'order_id')) where method = 'card';
-- One live attempt per order: a second tap resumes it instead of opening a second checkout.
create unique index if not exists app_payments_one_live_idx
  on public.app_payments (order_id) where status = 'initiated';
-- The worker's queue: open attempts, and closed ones FIB has not given a final answer about.
create index if not exists app_payments_check_queue_idx
  on public.app_payments (provider_next_check_at, created_at)
  where provider_reference is not null and provider_terminal_at is null;

alter table public.app_payments enable row level security;
revoke all on public.app_payments from anon, authenticated;
grant select on public.app_payments to authenticated;
drop policy if exists "customers read own payments" on public.app_payments;
create policy "customers read own payments" on public.app_payments for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));

-- ── Rules on the order ──────────────────────────────────────────────────────
-- * Cash (cod / store) is collected when the order is handed over: delivered or picked = paid.
-- * An FIB / card order is goods sent against money that has not arrived: it may be cancelled,
--   but not confirmed, packed or sent until it is paid. Cash orders move from the start.
-- * payment_status is otherwise written only by the payment functions below (they run as the
--   owner), except that an admin may record a refund of a paid order. `pay` never changes.
create or replace function app_private.app_order_payment_rules()
returns trigger language plpgsql set search_path = '' as $$
declare v_cash boolean := false;
begin
  if new.pay is distinct from old.pay then
    raise exception 'pay_locked' using errcode = 'P0001';
  end if;
  if new.pay in ('cod', 'store') and old.payment_status = 'unpaid' and new.special is null
     and new.status in ('delivered', 'picked') and new.status is distinct from old.status then
    new.payment_status := 'paid';
    new.paid_at := coalesce(new.paid_at, now());
    v_cash := true;
  end if;
  if new.payment_status is distinct from old.payment_status and not v_cash
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if not (new.payment_status = 'refunded' and old.payment_status = 'paid') then
      raise exception 'payment_status_locked' using errcode = 'P0001';
    end if;
    if not public.is_admin() then
      raise exception 'payment_status_locked' using errcode = 'P0001';
    end if;
  end if;
  if new.pay in ('fib', 'card') and new.payment_status <> 'paid'
     and new.status is distinct from old.status and new.status <> 'placed' then
    raise exception 'not_paid' using errcode = 'P0001',
      detail = 'An FIB or card order moves on only after it is paid.';
  end if;
  return new;
end $$;
drop trigger if exists app_orders_payment_rules on public.app_orders;
create trigger app_orders_payment_rules before update on public.app_orders
  for each row execute function app_private.app_order_payment_rules();

-- ── Placing an order: FIB and card added ────────────────────────────────────
-- Unchanged from 20261108190000 except: `pay` may be fib or card when that method is switched on,
-- and such an order gets a deadline to pay (pay_by).
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
  v_set   public.app_settings;
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

  select * into v_set from public.app_settings s where s.id = 1;

  if v_type not in ('delivery','pickup') then raise exception 'bad_request' using errcode = 'P0001', detail = 'type'; end if;
  v_pay := coalesce(nullif(p_order->>'pay', ''), case when v_type = 'pickup' then 'store' else 'cod' end);
  if v_pay not in ('cod','store','fib','card') then raise exception 'bad_request' using errcode = 'P0001', detail = 'pay'; end if;
  if (v_pay = 'cod' and v_type <> 'delivery') or (v_pay = 'store' and v_type <> 'pickup') then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'pay';
  end if;
  -- Refused at placement: an order nobody can pay for should never exist.
  if (v_pay = 'fib' and not coalesce(v_set.fib_enabled, false))
     or (v_pay = 'card' and not coalesce(v_set.card_enabled, false)) then
    raise exception 'payment_unavailable' using errcode = 'P0001', detail = v_pay;
  end if;
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

  v_fee := case when v_type = 'pickup' then 0 else coalesce(v_set.delivery_fee, 5000) end;

  insert into public.app_orders (customer_id, type, status, city, branch, address, receiver_name, receiver_phone,
                                 note, slot, pay, subtotal, discount, delivery_fee, total, client_ref, pay_by)
  values (v_uid, v_type, 'placed', coalesce(nullif(p_order->>'city', ''), 'erbil'),
          case when v_type = 'pickup' then coalesce(nullif(p_order->>'branch', ''), 'muzaffariya') end,
          case when v_type = 'delivery' then p_order->'address' end,
          v_name, v_phone, v_note,
          case when jsonb_typeof(p_order->'slot') = 'object' then p_order->'slot' end,
          v_pay, v_sub, 0, v_fee, v_sub + v_fee, v_ref,
          case when v_pay in ('fib', 'card')
               then now() + make_interval(mins => coalesce(v_set.pay_window_minutes, 60)) end)
  returning * into v_row;

  insert into public.app_order_items (order_id, product_id, zoho_id, name, qty, unit_price, options)
  select v_row.id, l->>'product_id', l->>'zoho_id', l->>'name', (l->>'qty')::integer, (l->>'unit_price')::integer, l->'options'
  from jsonb_array_elements(v_lines) l;

  return v_row;
end $$;
revoke all on function public.place_app_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_app_order(jsonb, jsonb) to authenticated;

-- ── Opening an attempt (runs as the customer, through app-payment-start) ───
-- Returns the attempt's id: the live one when there is one (same key or not, one per order), else
-- a new one. The amount is the order's total, never the caller's.
create or replace function public.start_app_payment(p_order_id text, p_idempotency_key text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o        public.app_orders;
  v_set    public.app_settings;
  existing uuid;
  new_id   uuid;
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode = 'P0001'; end if;
  select * into o from public.app_orders where id = p_order_id for update;
  if o.id is null or o.customer_id is distinct from auth.uid() then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if o.pay not in ('fib', 'card') then raise exception 'not_online' using errcode = 'P0001'; end if;
  if o.payment_status = 'paid' then
    select p.id into existing from public.app_payments p
     where p.order_id = o.id and p.status = 'succeeded' order by p.confirmed_at desc nulls last limit 1;
    if existing is not null then return existing; end if;
    raise exception 'already_paid' using errcode = 'P0001';
  end if;
  if o.special = 'cancelled' then raise exception 'order_cancelled' using errcode = 'P0001'; end if;
  if o.total <= 0 then raise exception 'nothing_to_pay' using errcode = 'P0001'; end if;

  select p.id into existing from public.app_payments p where p.order_id = o.id and p.status = 'initiated';
  if existing is not null then return existing; end if;

  -- New attempts only while the method is on and the time to pay is not over.
  select * into v_set from public.app_settings s where s.id = 1;
  if (o.pay = 'fib' and not v_set.fib_enabled) or (o.pay = 'card' and not v_set.card_enabled) then
    raise exception 'payment_unavailable' using errcode = 'P0001', detail = o.pay;
  end if;
  if o.pay_by is not null and o.pay_by <= now() then
    raise exception 'pay_window_over' using errcode = 'P0001';
  end if;

  insert into public.app_payments (order_id, customer_id, amount_iqd, method, idempotency_key)
  values (o.id, o.customer_id, o.total, o.pay, nullif(btrim(p_idempotency_key), ''))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.start_app_payment(text, text) from public, anon;
grant execute on function public.start_app_payment(text, text) to authenticated, service_role;

-- ── Service-role only: what FIB said ────────────────────────────────────────
-- One winner: only the request that claims creation talks to FIB, so two taps never open two
-- checkouts. FIB has no create idempotency key, so the claim time is the only evidence an attempt
-- ever left the function.
create or replace function public.claim_app_payment_creation(p_payment_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
  update public.app_payments p set provider_creation_started_at = now()
   where p.id = p_payment_id and p.status = 'initiated' and p.provider_reference is null
     and (p.provider_creation_started_at is null or p.provider_creation_started_at < now() - interval '2 minutes')
     and exists (select 1 from public.app_orders o where o.id = p.order_id and o.payment_status = 'unpaid'
                 and o.special is distinct from 'cancelled' and o.pay = p.method and o.total = p.amount_iqd);
  get diagnostics claimed = row_count;
  return claimed = 1;
end $$;

create or replace function public.record_app_payment_provider_details(
  p_payment_id uuid, p_provider_reference text, p_provider_expires_at timestamptz, p_provider_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.app_payments
     set provider_reference = p_provider_reference,
         provider_expires_at = p_provider_expires_at,
         provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
         provider_next_check_at = now() + interval '1 minute'
   where id = p_payment_id and status = 'initiated';
end $$;

-- The only place an order becomes paid online. Idempotent: FIB retries its callback and the app
-- and the worker also ask, so this runs more than once for one payment as a matter of course.
-- Money that arrives for an order cancelled meanwhile is still recorded (the dashboard shows the
-- order as cancelled and paid: refund it from the bank's portal, then mark it refunded).
create or replace function public.record_app_payment_success(p_payment_id uuid, p_provider_reference text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare pay public.app_payments;
begin
  select * into pay from public.app_payments where id = p_payment_id for update;
  if pay.id is null then raise exception 'payment not found'; end if;
  if pay.status <> 'succeeded' then
    update public.app_payments
       set status = 'succeeded',
           provider_reference = coalesce(p_provider_reference, provider_reference),
           confirmed_at = now(), provider_terminal_at = now(), failure_reason = null
     where id = pay.id;
  end if;
  update public.app_orders
     set payment_status = 'paid', paid_at = coalesce(paid_at, now())
   where id = pay.order_id and payment_status = 'unpaid';
end $$;

create or replace function public.record_app_payment_failure(p_payment_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- A settled payment is never walked back by a late failure.
  update public.app_payments
     set status = 'failed', failure_reason = nullif(btrim(p_reason), ''), provider_terminal_at = now()
   where id = p_payment_id and status <> 'succeeded';
end $$;

-- Our window closed while FIB still said not paid. FIB attempts stay in the worker's queue
-- (provider_terminal_at stays empty) until FIB confirms the checkout is cancelled or paid: an
-- expiry is not proof that no money settled in the last seconds.
create or replace function public.expire_app_payment(p_payment_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.app_payments
     set status = 'expired', failure_reason = nullif(btrim(p_reason), ''),
         provider_terminal_at = case when method = 'fib' and provider_reference is not null then null else now() end
   where id = p_payment_id and status in ('initiated', 'expired');
end $$;

-- FIB confirmed the checkout is cancelled (after an authoritative UNPAID).
create or replace function public.record_app_payment_cancelled(p_payment_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.app_payments
     set status = case when status = 'initiated' then 'cancelled' else status end,
         failure_reason = coalesce(failure_reason, nullif(btrim(p_reason), '')),
         provider_terminal_at = now()
   where id = p_payment_id and status <> 'succeeded';
end $$;

-- The worker's next look at an attempt, and what it last saw.
create or replace function public.note_app_payment_check(
  p_payment_id uuid, p_next_check_at timestamptz, p_note jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.app_payments
     set provider_next_check_at = p_next_check_at,
         provider_payload = provider_payload || coalesce(p_note, '{}'::jsonb)
   where id = p_payment_id;
end $$;

-- Attempts the worker should ask FIB about now (leased for 2 minutes so overlapping runs do not
-- ask twice).
create or replace function public.claim_app_payment_checks(p_limit integer default 20)
returns setof public.app_payments language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.app_payments p set provider_next_check_at = now() + interval '2 minutes'
   where p.id in (
     select q.id from public.app_payments q
      where q.provider_reference is not null and q.provider_terminal_at is null
        and (q.provider_next_check_at is null or q.provider_next_check_at <= now())
      order by q.provider_next_check_at nulls first, q.created_at
      limit greatest(1, least(p_limit, 50))
      for update skip locked)
  returning p.*;
end $$;

-- Unpaid FIB / card orders whose time to pay is over, with no attempt FIB could still settle, are
-- cancelled (10 minutes' grace after pay_by, for a payment made in the last seconds).
create or replace function public.cancel_unpaid_app_orders()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.app_orders o
     set special = 'cancelled', cancelled_by = 'unpaid'
   where o.pay in ('fib', 'card') and o.payment_status = 'unpaid' and o.special is null
     and o.status = 'placed' and o.pay_by is not null and o.pay_by < now() - interval '10 minutes'
     and not exists (select 1 from public.app_payments p where p.order_id = o.id
                     and (p.status = 'initiated' or (p.provider_reference is not null and p.provider_terminal_at is null)));
  get diagnostics n = row_count;
  -- Attempts that never reached FIB (no reference) are closed with their order.
  update public.app_payments p set status = 'cancelled', provider_terminal_at = now(),
         failure_reason = coalesce(p.failure_reason, 'order cancelled before payment')
   where p.status = 'initiated' and p.provider_reference is null
     and exists (select 1 from public.app_orders o where o.id = p.order_id and o.special = 'cancelled');
  return n;
end $$;

revoke all on function public.claim_app_payment_creation(uuid) from public, anon, authenticated;
revoke all on function public.record_app_payment_provider_details(uuid, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.record_app_payment_success(uuid, text) from public, anon, authenticated;
revoke all on function public.record_app_payment_failure(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_app_payment(uuid, text) from public, anon, authenticated;
revoke all on function public.record_app_payment_cancelled(uuid, text) from public, anon, authenticated;
revoke all on function public.note_app_payment_check(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.claim_app_payment_checks(integer) from public, anon, authenticated;
revoke all on function public.cancel_unpaid_app_orders() from public, anon, authenticated;
grant execute on function public.claim_app_payment_creation(uuid) to service_role;
grant execute on function public.record_app_payment_provider_details(uuid, text, timestamptz, jsonb) to service_role;
grant execute on function public.record_app_payment_success(uuid, text) to service_role;
grant execute on function public.record_app_payment_failure(uuid, text) to service_role;
grant execute on function public.expire_app_payment(uuid, text) to service_role;
grant execute on function public.record_app_payment_cancelled(uuid, text) to service_role;
grant execute on function public.note_app_payment_check(uuid, timestamptz, jsonb) to service_role;
grant execute on function public.claim_app_payment_checks(integer) to service_role;
grant execute on function public.cancel_unpaid_app_orders() to service_role;

-- ── Customers cancelling: a paid online order says it will be refunded ─────
-- Same rule as before (until packed). Closing an unpaid order's open attempt is left to the
-- worker, which asks FIB first.
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
  update public.app_payments set provider_next_check_at = now()
   where order_id = v_row.id and status = 'initiated';
  return v_row;
end $$;
revoke all on function public.cancel_app_order(text) from public, anon;
grant execute on function public.cancel_app_order(text) to authenticated;

-- ── The catalog tells the apps which methods are on ─────────────────────────
-- Unchanged from 20261108200000 except settings.payments.
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
                                   'price_round_to', s.price_round_to,
                                   'payments', jsonb_build_object('fib', s.fib_enabled, 'card', s.card_enabled)),
    'fx', jsonb_build_object('rate', app_private.fx(),
                             'source', case when s.usd_iqd_rate is not null then 'manual' else s.fx_source end,
                             'as_of', case when s.usd_iqd_rate is null then s.fx_as_of end),
    'synced_at', s.catalog_synced_at)
  into v
  from public.app_settings s where s.id = 1;
  ver := md5(concat_ws('|', v->>'products', v->>'banners', v->>'settings', v->'fx'->>'rate', v->'fx'->>'source'));
  if p_version is not null and p_version = ver then
    return jsonb_build_object('version', ver, 'unchanged', true);
  end if;
  return v || jsonb_build_object('version', ver);
end $$;
revoke all on function public.app_catalog(text) from public;
grant execute on function public.app_catalog(text) to anon, authenticated;

-- ── The safety net: every minute ────────────────────────────────────────────
-- FIB's callbacks settle most payments within seconds; app-payments-reconcile settles the rest
-- (a lost callback, a customer who paid and never came back). It is called through pg_net with a
-- key kept in Vault, never in this file:
--   select vault.create_secret('<long random string>', 'app_payments_reconcile_key');
-- and the same value as the Edge secret APP_PAYMENTS_RECONCILE_KEY. Without the Vault secret the
-- job only cancels unpaid orders.
insert into app_private.config (key, value) values
  ('functions_url', 'https://oqvddrybohahzghgrjeu.supabase.co/functions/v1')
on conflict (key) do nothing;

create or replace function app_private.invoke_payment_checks()
returns void language plpgsql security definer set search_path = '' as $$
declare v_key text; v_url text;
begin
  perform public.cancel_unpaid_app_orders();
  select value into v_url from app_private.config where key = 'functions_url';
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'app_payments_reconcile_key';
  exception when others then
    v_key := null;
  end;
  if v_key is null or v_url is null then return; end if;
  if not exists (select 1 from public.app_payments
                  where provider_reference is not null and provider_terminal_at is null
                    and (provider_next_check_at is null or provider_next_check_at <= now())) then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/app-payments-reconcile',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reconcile-key', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
end $$;
revoke all on function app_private.invoke_payment_checks() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'app-payment-checks';
select cron.schedule('app-payment-checks', '* * * * *', 'select app_private.invoke_payment_checks()');

notify pgrst, 'reload schema';
