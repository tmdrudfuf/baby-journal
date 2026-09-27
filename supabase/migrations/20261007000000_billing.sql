-- M8: subscriptions. Google Play purchases are verified by the `billing` edge function (service role),
-- which is the only writer of purchases and store entitlements. The client never sets a plan or expiry.

-- Plan features (§40). Monthly Memories stays free: it already shipped to families (owner decision pending).
alter table public.plans
  add column ai_daily boolean not null default false,
  add column ai_ask boolean not null default false;
update public.plans set ai_daily = true, ai_ask = true where id in ('plus', 'family');

-- Store product -> plan. Change rows, not code.
create table public.plan_products (
  product_id text primary key,
  plan_id text not null references public.plans (id)
);
insert into public.plan_products (product_id, plan_id) values
  ('plus_monthly', 'plus'), ('plus_yearly', 'plus'), ('family_monthly', 'family'), ('family_yearly', 'family');
alter table public.plan_products enable row level security;
create policy plan_products_select on public.plan_products for select to authenticated using (true);

-- One row per store purchase token. The token is kept so the server can re-check renewals and
-- cancellations with Google without the purchaser's phone. Service role only (no policies).
create table public.purchases (
  purchase_token text primary key, -- a token binds to exactly one family
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null, -- who bought it
  provider text not null check (provider in ('google_play', 'mock')),
  product_id text not null references public.plan_products (product_id),
  state text not null check (state in ('active', 'grace', 'on_hold', 'paused', 'canceled', 'expired', 'pending')),
  expires_at timestamptz,
  acknowledged boolean not null default false,
  updated_at timestamptz not null default now()
);
create index purchases_family_idx on public.purchases (family_id);
create index purchases_expiry_idx on public.purchases (expires_at) where state in ('active', 'grace', 'canceled');
alter table public.purchases enable row level security;

-- Rebuild a family's store entitlement from its purchases: the largest plan with time left wins.
-- Canceled subscriptions keep their plan until the paid period ends. Manual grants are never touched.
create function public.sync_store_entitlement(fid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  best record;
begin
  select pp.plan_id, pu.expires_at, pu.provider into best
  from public.purchases pu
  join public.plan_products pp using (product_id)
  join public.plans p on p.id = pp.plan_id
  where pu.family_id = fid
    and pu.state in ('active', 'grace', 'canceled')
    and pu.expires_at > now()
  order by p.storage_bytes desc, pu.expires_at desc
  limit 1;

  if best is null then
    delete from public.entitlements where family_id = fid and source = 'google_play';
  else
    insert into public.entitlements (family_id, plan_id, source, expires_at, updated_at)
    values (fid, best.plan_id, 'google_play', best.expires_at, now())
    on conflict (family_id) do update
      set plan_id = excluded.plan_id, source = excluded.source, expires_at = excluded.expires_at, updated_at = now()
      where public.entitlements.source <> 'manual';
  end if;
end;
$$;
revoke execute on function public.sync_store_entitlement(uuid) from public, anon, authenticated;

-- Renewals and cancellations: every 6 hours, re-check purchases that end within 3 days.
-- Uses the same Vault secrets as purge-media; without them (local) the job does nothing.
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
  where exists (select 1 from public.purchases where state in ('active', 'grace', 'canceled') and expires_at < now() + interval '3 days')
    and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $$
);
