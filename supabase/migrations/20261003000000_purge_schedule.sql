-- Scheduled R2 sweep: every 15 minutes, if anything is queued, ask media-sign to purge it.
-- Needs two Vault secrets set once per environment (never in git):
--   select vault.create_secret('<https://<ref>.supabase.co>', 'project_url');
--   select vault.create_secret('<service role key>', 'service_role_key');
-- Without them (e.g. local) the job does nothing.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'purge-media',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/media-sign',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"action":"purge"}'::jsonb
  )
  where exists (select 1 from public.media_deletions)
    and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $$
);
