-- ITland: admins must use two-step sign-in (authenticator app code). Applies on top of
-- 20261111100000_app_push_history_quick_edits.sql.
--
-- APPLY ONLY AFTER the website with the two-step admin login is deployed (and the apps with it are in
-- your hands). From this moment an admin session without the code (aal1) is treated as a customer
-- everywhere: RLS on orders, products, banners, settings, storage, every admin RPC, the website
-- dashboard. Membership checks (admin_users own row, app_admin_me().listed) keep working, so the apps and
-- the website can still ask a listed admin for the code.
--
-- Undo (if you ever get locked out): run the body of is_admin() without the aal line, i.e.
--   create or replace function public.is_admin() returns boolean language sql stable security definer
--   set search_path = '' as $$ select app_private.is_listed_admin(); $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app_private.is_listed_admin() and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

notify pgrst, 'reload schema';
