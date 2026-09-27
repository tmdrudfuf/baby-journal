-- M8 fix: pending payments have no expiry yet; include them so a payment that clears later is
-- acknowledged (Play refunds unacknowledged purchases after 3 days). Same job name replaces the old one.
select cron.schedule(
  'refresh-purchases',
  '17 */6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/billing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"action":"refresh"}'::jsonb
  )
  where exists (
      select 1 from public.purchases
      where state = 'pending'
         or (state in ('active', 'grace', 'canceled') and expires_at < now() + interval '3 days'))
    and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $$
);
