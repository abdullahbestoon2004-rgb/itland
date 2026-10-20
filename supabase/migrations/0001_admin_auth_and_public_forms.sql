-- IT Land — admin auth, locked-down settings, and real form storage.
-- Run this once in Supabase → SQL Editor (or `supabase db push`).

-- ── Who counts as an admin ────────────────────────────────────────────────────
create table if not exists public.admin_users (
  email       text primary key,
  created_at  timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Reads the email off the current JWT. Security definer so policies can call it
-- without granting anyone direct access to admin_users.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "admins read admin list" on public.admin_users;
create policy "admins read admin list"
  on public.admin_users for select
  using (public.is_admin());

-- ── Site settings: world-readable, admin-writable ─────────────────────────────
create table if not exists public.site_settings (
  id                      bigint primary key,
  promo_banner_visible    boolean,
  promo_banner_title      text,
  promo_banner_subtitle   text,
  promo_banner_image      text,
  featured_categories     jsonb,
  updated_at              timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "public reads settings"    on public.site_settings;
drop policy if exists "admins insert settings"   on public.site_settings;
drop policy if exists "admins update settings"   on public.site_settings;

create policy "public reads settings"
  on public.site_settings for select
  using (true);

create policy "admins insert settings"
  on public.site_settings for insert
  with check (public.is_admin());

create policy "admins update settings"
  on public.site_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── Contact form submissions ──────────────────────────────────────────────────
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  message     text not null,
  handled     boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint contact_name_len    check (char_length(name) between 1 and 120),
  constraint contact_email_len   check (char_length(email) between 3 and 200),
  constraint contact_message_len check (char_length(message) between 1 and 4000)
);

alter table public.contact_messages enable row level security;

drop policy if exists "anyone submits a message"  on public.contact_messages;
drop policy if exists "admins read messages"      on public.contact_messages;
drop policy if exists "admins update messages"    on public.contact_messages;

create policy "anyone submits a message"
  on public.contact_messages for insert
  with check (true);

create policy "admins read messages"
  on public.contact_messages for select
  using (public.is_admin());

create policy "admins update messages"
  on public.contact_messages for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── Newsletter subscribers ────────────────────────────────────────────────────
create table if not exists public.newsletter_subscribers (
  email       text primary key,
  created_at  timestamptz not null default now(),
  constraint newsletter_email_len check (char_length(email) between 3 and 200)
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "anyone subscribes"         on public.newsletter_subscribers;
drop policy if exists "admins read subscribers"   on public.newsletter_subscribers;

create policy "anyone subscribes"
  on public.newsletter_subscribers for insert
  with check (true);

create policy "admins read subscribers"
  on public.newsletter_subscribers for select
  using (public.is_admin());

-- ── Customer reviews: submitted by anyone, shown only once approved ───────────
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  text        text not null,
  rating      smallint not null,
  approved    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint review_name_len check (char_length(name) between 1 and 80),
  constraint review_text_len check (char_length(text) between 1 and 1000),
  constraint review_rating    check (rating between 1 and 5)
);

alter table public.reviews enable row level security;

drop policy if exists "public reads approved reviews" on public.reviews;
drop policy if exists "anyone submits a review"       on public.reviews;
drop policy if exists "admins read all reviews"       on public.reviews;
drop policy if exists "admins moderate reviews"       on public.reviews;
drop policy if exists "admins delete reviews"         on public.reviews;

create policy "public reads approved reviews"
  on public.reviews for select
  using (approved = true);

create policy "anyone submits a review"
  on public.reviews for insert
  with check (approved = false);

create policy "admins read all reviews"
  on public.reviews for select
  using (public.is_admin());

create policy "admins moderate reviews"
  on public.reviews for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins delete reviews"
  on public.reviews for delete
  using (public.is_admin());

create index if not exists reviews_approved_created_idx
  on public.reviews (approved, created_at desc);
