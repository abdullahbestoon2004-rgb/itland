-- Grants admin access. Add one row per admin; the email must match the Google
-- account used to sign in at /admin/login.
insert into public.admin_users (email)
values ('abdullahbestoon2004@gmail.com')
on conflict (email) do nothing;
