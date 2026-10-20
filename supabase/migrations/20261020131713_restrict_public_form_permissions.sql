-- Public forms may submit data, but only allow-listed signed-in admins can read it.
-- Admin membership can be checked without a SECURITY DEFINER or recursive RLS.
drop policy if exists "admins read admin list" on public.admin_users;
drop policy if exists "admins read own admin membership" on public.admin_users;
create policy "admins read own admin membership"
  on public.admin_users for select to authenticated
  using ((select auth.uid()) is not null
    and lower(email) = lower(coalesce((select auth.jwt())->>'email', '')));

create or replace function public.is_admin()
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- Replace inherited broad privileges with exactly the operations the app uses.
revoke all on public.admin_users, public.site_settings, public.contact_messages,
  public.newsletter_subscribers, public.reviews from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.admin_users to authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
grant insert (name, email, message) on public.contact_messages to anon, authenticated;
grant select, update on public.contact_messages to authenticated;
grant insert (email) on public.newsletter_subscribers to anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (name, text, rating, approved) on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;

drop policy if exists "public reads settings" on public.site_settings;
create policy "public reads settings" on public.site_settings
  for select to anon, authenticated using (true);
drop policy if exists "admins insert settings" on public.site_settings;
create policy "admins insert settings" on public.site_settings
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admins update settings" on public.site_settings;
create policy "admins update settings" on public.site_settings
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "anyone submits a message" on public.contact_messages;
create policy "anyone submits a message" on public.contact_messages
  for insert to anon, authenticated with check (handled = false);
drop policy if exists "admins read messages" on public.contact_messages;
create policy "admins read messages" on public.contact_messages
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins update messages" on public.contact_messages;
create policy "admins update messages" on public.contact_messages
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "anyone subscribes" on public.newsletter_subscribers;
create policy "anyone subscribes" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);
drop policy if exists "admins read subscribers" on public.newsletter_subscribers;
create policy "admins read subscribers" on public.newsletter_subscribers
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "public reads approved reviews" on public.reviews;
create policy "public reads approved reviews" on public.reviews
  for select to anon, authenticated using (approved = true);
drop policy if exists "anyone submits a review" on public.reviews;
create policy "anyone submits a review" on public.reviews
  for insert to anon, authenticated with check (approved = false);
drop policy if exists "admins read all reviews" on public.reviews;
create policy "admins read all reviews" on public.reviews
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins moderate reviews" on public.reviews;
create policy "admins moderate reviews" on public.reviews
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists "admins delete reviews" on public.reviews;
create policy "admins delete reviews" on public.reviews
  for delete to authenticated using ((select public.is_admin()));
