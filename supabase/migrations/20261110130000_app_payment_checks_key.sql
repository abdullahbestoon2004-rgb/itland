-- The payment check job's key, made inside the database. Applies on top of
-- 20261110120000_app_online_payments.sql.
--
-- app-payments-reconcile only runs for a caller that sends the right x-reconcile-key. Instead of a
-- value someone has to create and paste into both Vault and the Edge secrets, the key is generated
-- here, kept in Vault, and the function asks app_payment_checks_key_ok() (service role only)
-- whether the key it was sent is that one. The key never leaves the database.
--
-- The job also sends the project's publishable key (public: the apps ship it) as apikey and
-- Authorization, so the Edge gateway lets the call through whatever its JWT setting is. Add it by
-- hand (kept out of this repo, like the Tawaf key in app_private.config):
--   insert into app_private.config (key, value) values ('publishable_key', '<sb_publishable_…>')
--   on conflict (key) do update set value = excluded.value;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'app_payments_reconcile_key') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'app_payments_reconcile_key',
      'Checked by the app-payments-reconcile edge function (x-reconcile-key)');
  end if;
end $$;

create or replace function public.app_payment_checks_key_ok(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_key) >= 24 and p_key = (
    select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'app_payments_reconcile_key'), false);
$$;
revoke all on function public.app_payment_checks_key_ok(text) from public, anon, authenticated;
grant execute on function public.app_payment_checks_key_ok(text) to service_role;

-- Unchanged from 20261110120000 except the publishable key headers.
create or replace function app_private.invoke_payment_checks()
returns void language plpgsql security definer set search_path = '' as $$
declare v_key text; v_url text; v_pk text; v_headers jsonb;
begin
  perform public.cancel_unpaid_app_orders();
  select value into v_url from app_private.config where key = 'functions_url';
  select value into v_pk from app_private.config where key = 'publishable_key';
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
  v_headers := jsonb_build_object('Content-Type', 'application/json', 'x-reconcile-key', v_key);
  if v_pk is not null then
    v_headers := v_headers || jsonb_build_object('apikey', v_pk, 'Authorization', 'Bearer ' || v_pk);
  end if;
  perform net.http_post(
    url := v_url || '/app-payments-reconcile',
    headers := v_headers,
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
end $$;
revoke all on function app_private.invoke_payment_checks() from public, anon, authenticated;

notify pgrst, 'reload schema';
