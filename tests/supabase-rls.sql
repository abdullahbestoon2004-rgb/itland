-- Non-persistent RLS verification against the IT Land database. All writes roll back.
begin;
set local role anon;
insert into public.newsletter_subscribers(email) values ('codex-rls-check@example.invalid');
insert into public.contact_messages(name,email,message) values ('Codex RLS test','codex-rls-check@example.invalid','Disposable RLS verification');
insert into public.reviews(name,text,rating,approved) values ('Codex RLS test','Disposable RLS verification',5,false);
do $$ begin
  if exists (select 1 from public.reviews where name='Codex RLS test') then
    raise exception 'Anonymous users can read pending reviews';
  end if;
  begin
    perform 1 from public.newsletter_subscribers;
    raise exception 'Anonymous newsletter read was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.contact_messages;
    raise exception 'Anonymous contact-message read was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.reviews(name,text,rating,approved) values ('Codex RLS test','Must fail',5,true);
    raise exception 'Anonymous review self-approval was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.site_settings(id) values(999999);
    raise exception 'Anonymous settings write was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","email":"abdullahbestoon2004@gmail.com"}',true);
do $$ begin
  if not public.is_admin() then raise exception 'Allow-listed admin was denied'; end if;
  if not exists(select 1 from public.newsletter_subscribers where email='codex-rls-check@example.invalid') then raise exception 'Admin cannot read newsletter'; end if;
  if not exists(select 1 from public.contact_messages where email='codex-rls-check@example.invalid') then raise exception 'Admin cannot read contact messages'; end if;
  update public.reviews set approved=true where name='Codex RLS test';
  if not exists(select 1 from public.reviews where name='Codex RLS test' and approved) then raise exception 'Admin cannot moderate reviews'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","email":"codex-nonadmin@example.invalid"}',true);
do $$ begin
  if public.is_admin() then raise exception 'Non-admin gained admin status'; end if;
  if exists(select 1 from public.newsletter_subscribers) then raise exception 'Non-admin can read newsletter'; end if;
  if exists(select 1 from public.contact_messages) then raise exception 'Non-admin can read contact messages'; end if;
  if exists(select 1 from public.admin_users) then raise exception 'Non-admin can enumerate admin allow-list'; end if;
  begin
    insert into public.site_settings(id) values(999999);
    raise exception 'Non-admin settings write was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select jsonb_build_object('rls_checks','passed','test_rows_retained',0,
  'tables', (select jsonb_object_agg(tablename,rowsecurity) from pg_tables where schemaname='public')) as verification;
