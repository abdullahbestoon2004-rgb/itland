-- ITland: the small store dashboard inside the mobile apps (SwiftUI + Flutter).
--
-- What the apps already could do as an admin (no change needed here): read every order with its items and
-- customer (RLS: is_admin()), move an order along / delay / cancel / refund it (update app_orders), upload
-- photos to the public app-media bucket. This migration adds:
--   1. Owners and admins. admin_users.role: 'owner' may add and remove admins (in the app: Account → Store
--      dashboard → Admins); 'admin' runs orders and photos. Both are full admins everywhere else (is_admin()
--      is unchanged, so the website dashboard works as before).
--   2. app_admin_me()            → {admin, owner} for the signed-in account (the apps show the dashboard row).
--   3. admin_list_admins()       → every admin (any admin may look; only owners change it).
--   4. admin_add_admin(email, role), admin_remove_admin(email)  (owners only; nobody changes or removes themself,
--      so there is always at least one owner).
--   5. admin_set_product_image(product, url, color)  sets a product's main photo or one colour's photo. A plain
--      Zoho item ('z-<zoho id>') first gets its light overlay row, exactly as the website dashboard does.
--      An empty url = back to the Zoho photo (main photo) / the product's main photo (a colour).
--
-- Run once in Supabase → SQL Editor. Safe to run again.

-- ── 1. Roles ─────────────────────────────────────────────────────────────────
alter table public.admin_users add column if not exists role text not null default 'admin';
alter table public.admin_users add column if not exists added_by text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'admin_users_role_check') then
    alter table public.admin_users add constraint admin_users_role_check check (role in ('owner', 'admin'));
  end if;
end $$;

-- The first admin (0002_seed_admin.sql) is the owner.
insert into public.admin_users (email, role) values ('abdullahbestoon2004@gmail.com', 'owner')
on conflict (email) do update set role = 'owner';

-- ── 2. Who am I ──────────────────────────────────────────────────────────────
create or replace function public.is_app_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt()->>'email', '')) and a.role = 'owner'
  );
$$;
revoke all on function public.is_app_owner() from public, anon;
grant execute on function public.is_app_owner() to authenticated, service_role;

create or replace function public.app_admin_me()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('admin', public.is_admin(), 'owner', public.is_app_owner());
$$;
revoke all on function public.app_admin_me() from public, anon;
grant execute on function public.app_admin_me() to authenticated;

-- ── 3. The admin list ────────────────────────────────────────────────────────
create or replace function public.admin_list_admins()
returns table (email text, role text, created_at timestamptz, added_by text, has_account boolean, is_you boolean)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select a.email, a.role, a.created_at, a.added_by,
           exists (select 1 from auth.users u where lower(u.email) = lower(a.email) and u.email_confirmed_at is not null),
           lower(a.email) = lower(coalesce(auth.jwt()->>'email', ''))
    from public.admin_users a
    order by (a.role = 'owner') desc, a.created_at;
end $$;
revoke all on function public.admin_list_admins() from public, anon;
grant execute on function public.admin_list_admins() to authenticated;

-- ── 4. Add / remove (owners only) ────────────────────────────────────────────
create or replace function public.admin_add_admin(p_email text, p_role text default 'admin')
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role  text := coalesce(nullif(btrim(p_role), ''), 'admin');
  v_me    text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if not public.is_app_owner() then raise exception 'owner_only' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'email';
  end if;
  if v_role not in ('owner', 'admin') then raise exception 'bad_request' using errcode = 'P0001', detail = 'role'; end if;
  if v_email = v_me then raise exception 'self' using errcode = 'P0001'; end if;
  insert into public.admin_users (email, role, added_by) values (v_email, v_role, v_me)
  on conflict (email) do update set role = excluded.role;
  return jsonb_build_object('email', v_email, 'role', v_role);
end $$;
revoke all on function public.admin_add_admin(text, text) from public, anon;
grant execute on function public.admin_add_admin(text, text) to authenticated;

create or replace function public.admin_remove_admin(p_email text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_me    text := lower(coalesce(auth.jwt()->>'email', ''));
  v_n     integer;
begin
  if not public.is_app_owner() then raise exception 'owner_only' using errcode = 'P0001'; end if;
  if v_email = v_me then raise exception 'self' using errcode = 'P0001'; end if;
  delete from public.admin_users a where lower(a.email) = v_email;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('email', v_email, 'removed', true);
end $$;
revoke all on function public.admin_remove_admin(text) from public, anon;
grant execute on function public.admin_remove_admin(text) to authenticated;

-- ── 5. Product photos ────────────────────────────────────────────────────────
create or replace function public.admin_set_product_image(p_product_id text, p_image_url text, p_color text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id    text := btrim(coalesce(p_product_id, ''));
  v_url   text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_color text := nullif(btrim(coalesce(p_color, '')), '');
  v_zoho  text;
  v_order integer;
  v_row   public.app_products;
  v_n     integer;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_id = '' then raise exception 'bad_request' using errcode = 'P0001', detail = 'product'; end if;
  if v_url is not null and v_url !~ '^(https://|asset:)' then
    raise exception 'bad_request' using errcode = 'P0001', detail = 'image_url';
  end if;

  if not exists (select 1 from public.app_products p where p.id = v_id) then
    -- A plain Zoho item: make its light overlay row first (the same row the website dashboard makes).
    if v_id !~ '^z-' then raise exception 'not_found' using errcode = 'P0001', detail = v_id; end if;
    v_zoho := substr(v_id, 3);
    select z.zoho_order into v_order from public.app_zoho_items z where z.zoho_id = v_zoho;
    if not found then raise exception 'not_found' using errcode = 'P0001', detail = v_id; end if;
    if exists (select 1 from public.app_products p where p.zoho_id = v_zoho) then
      -- Another overlay already holds this Zoho item: change that one.
      select p.id into v_id from public.app_products p where p.zoho_id = v_zoho;
    else
      insert into public.app_products (id, zoho_id, sort) values (v_id, v_zoho, 100000 + coalesce(v_order, 0));
    end if;
  end if;

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
