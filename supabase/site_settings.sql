create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  promo_banner_visible boolean not null default true,
  promo_banner_title text not null default 'Up to 30% OFF Gaming Accessories',
  promo_banner_subtitle text not null default 'Level up your gameplay with premium gear at unbeatable prices.',
  promo_banner_image text not null default 'https://images.unsplash.com/photo-1717283413190-d4551453b92a?fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000',
  featured_categories jsonb not null default '[
    {"name":"Gaming Gear","image":"https://resource.logitechg.com/w_776,h_437,ar_16:9,c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/ghub-update/2025/g-hub-tips-and-tricks-5.jpg","path":"/products"},
    {"name":"Keyboards","image":"https://www.cnet.com/a/img/resize/f2ae5397b2da3754b3a3ceccd051452d6e102a71/hub/2025/02/25/f0d07227-6eaa-49e3-bf8a-09fec28c1ac3/logitech-pop-icon-keys.jpg?auto=webp&fit=crop&height=1200&width=1200","path":"/products"},
    {"name":"Mice","image":"https://media.wired.com/photos/65394d5de1bb680c1c7a7a11/master/w_1600%2Cc_limit/Logitech-POP-Mice-Gear.jpg","path":"/products"},
    {"name":"Headsets","image":"https://store.alnabaa.com/cdn/shop/files/1684885584_1763226.jpg?v=1716797196","path":"/products"}
  ]'::jsonb,
  updated_at timestamp with time zone not null default now()
);

insert into public.site_settings (
  id,
  promo_banner_visible,
  promo_banner_title,
  promo_banner_subtitle,
  promo_banner_image,
  featured_categories
)
values (
  1,
  true,
  'Up to 30% OFF Gaming Accessories',
  'Level up your gameplay with premium gear at unbeatable prices.',
  'https://images.unsplash.com/photo-1717283413190-d4551453b92a?fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000',
  '[
    {"name":"Gaming Gear","image":"https://resource.logitechg.com/w_776,h_437,ar_16:9,c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/ghub-update/2025/g-hub-tips-and-tricks-5.jpg","path":"/products"},
    {"name":"Keyboards","image":"https://www.cnet.com/a/img/resize/f2ae5397b2da3754b3a3ceccd051452d6e102a71/hub/2025/02/25/f0d07227-6eaa-49e3-bf8a-09fec28c1ac3/logitech-pop-icon-keys.jpg?auto=webp&fit=crop&height=1200&width=1200","path":"/products"},
    {"name":"Mice","image":"https://media.wired.com/photos/65394d5de1bb680c1c7a7a11/master/w_1600%2Cc_limit/Logitech-POP-Mice-Gear.jpg","path":"/products"},
    {"name":"Headsets","image":"https://store.alnabaa.com/cdn/shop/files/1684885584_1763226.jpg?v=1716797196","path":"/products"}
  ]'::jsonb
)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "Public site settings are readable" on public.site_settings;
drop policy if exists "Public site settings are insertable" on public.site_settings;
drop policy if exists "Public site settings are updateable" on public.site_settings;

create policy "Public site settings are readable"
on public.site_settings
for select
to anon
using (true);

create policy "Public site settings are insertable"
on public.site_settings
for insert
to anon
with check (true);

create policy "Public site settings are updateable"
on public.site_settings
for update
to anon
using (true)
with check (true);
