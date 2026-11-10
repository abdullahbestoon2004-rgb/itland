-- app_catalog's version now changes only when the catalog itself changes (products, banners,
-- settings, rate), not every time the 10-minute sync runs, so apps re-download only real changes.
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
  -- The version follows what the app shows, not the sync clock, so an unchanged catalog stays unchanged.
  ver := md5(concat_ws('|', v->>'products', v->>'banners', v->>'settings', v->'fx'->>'rate', v->'fx'->>'source'));
  if p_version is not null and p_version = ver then
    return jsonb_build_object('version', ver, 'unchanged', true);
  end if;
  return v || jsonb_build_object('version', ver);
end $$;
revoke all on function public.app_catalog(text) from public;
grant execute on function public.app_catalog(text) to anon, authenticated;
notify pgrst, 'reload schema';
