-- Applies after 20261108190000_app_zoho_catalog_and_accounts.sql (it does not depend on
-- 20261108200000_app_catalog_stable_version.sql, which only changed app_catalog()).
--
-- * A light 'z-<zoho id>' overlay (a Zoho item edited in the dashboard, or one a carousel slide
--   links to) now looks exactly like the plain Zoho item: no "Other" brand name when Zoho has no
--   brand, and "curated" stays false. Only real curated rows are curated.
-- * admin_delete_app_account(email): lets the store delete a customer's account when the customer
--   asks on WhatsApp or by email. Same rules as delete_my_app_account().

-- ── The catalog (same as 20261108190000, two changes marked "changed") ─────────
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
         -- changed: no brand set here = Zoho's brand name, or none (as for a plain Zoho item).
         case when nullif(p.brand, '') is null then nullif(z.brand, '')
              when p.brand = z.brand_id then coalesce(nullif(z.brand, ''), initcap(replace(p.brand, '-', ' ')))
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
         -- changed: a light 'z-<zoho id>' overlay is not a curated product.
         not (p.zoho_id is not null and p.id = 'z-' || p.zoho_id) as curated,
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
revoke all on function app_private.catalog_rows() from public, anon, authenticated;

-- ── Deleting a customer's account for them (dashboard) ─────────────────────────
-- For customers who ask on WhatsApp or by email. p_email is the account's email address.
-- p_confirm = false only looks the account up and returns what would happen:
--   {email, name, phone, created_at, last_sign_in_at, orders, to_cancel, in_progress, deleted}
-- p_confirm = true deletes it, with the same rules as delete_my_app_account(): orders not yet
-- packed are cancelled, past orders stay without the name, phone, address or note, and the
-- sign-in and profile are deleted.
-- Errors (message): bad_request, not_found, more_than_one, admin_account, order_in_progress.
create or replace function public.admin_delete_app_account(p_email text, p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ids   uuid[];
  v_uid   uuid;
  v_info  jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+$' then raise exception 'bad_request' using errcode = 'P0001', detail = 'email'; end if;

  select array_agg(u.id) into v_ids from auth.users u where lower(u.email) = v_email;
  if v_ids is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if cardinality(v_ids) > 1 then raise exception 'more_than_one' using errcode = 'P0001'; end if;
  v_uid := v_ids[1];
  if exists (select 1 from public.admin_users a where lower(a.email) = v_email) then
    raise exception 'admin_account' using errcode = 'P0001';
  end if;

  -- Lock the customer's orders, so none moves to packed between the check and the cancel.
  if p_confirm then
    perform 1 from public.app_orders o where o.customer_id = v_uid for update;
  end if;

  select jsonb_build_object(
           'email', u.email,
           'name', coalesce(nullif(btrim(c.name), ''), nullif(btrim(u.raw_user_meta_data->>'full_name'), '')),
           'phone', c.phone,
           'created_at', u.created_at,
           'last_sign_in_at', u.last_sign_in_at,
           'orders', (select count(*) from public.app_orders o where o.customer_id = v_uid),
           'to_cancel', (select count(*) from public.app_orders o
                          where o.customer_id = v_uid and o.special is null and o.status in ('placed','confirmed')),
           'in_progress', (select count(*) from public.app_orders o
                            where o.customer_id = v_uid and o.special is null and o.status in ('packed','out','ready')))
    into v_info
    from auth.users u
    left join public.app_customers c on c.id = u.id
   where u.id = v_uid;

  if not p_confirm then
    return v_info || jsonb_build_object('deleted', false);
  end if;
  if (v_info->>'in_progress')::integer > 0 then
    raise exception 'order_in_progress' using errcode = 'P0001';
  end if;

  update public.app_orders set special = 'cancelled', cancelled_by = 'you'
   where customer_id = v_uid and special is null and status in ('placed','confirmed');
  update public.app_orders
     set customer_id = null, receiver_name = 'Deleted account', receiver_phone = '', address = null, note = null
   where customer_id = v_uid;
  delete from public.app_customers where id = v_uid;
  delete from auth.users where id = v_uid;
  return v_info || jsonb_build_object('deleted', true);
end $$;
revoke all on function public.admin_delete_app_account(text, boolean) from public, anon;
grant execute on function public.admin_delete_app_account(text, boolean) to authenticated;

notify pgrst, 'reload schema';
