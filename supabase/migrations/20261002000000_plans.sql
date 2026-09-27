-- Milestone 8 groundwork: config-driven plans (§31), per-family entitlements, storage quota and
-- family-size limits enforced in the database. Billing (Google Play) will only write entitlements.
-- Existing memories are never made inaccessible by a quota (§65): limits only block new uploads/joins.

create table public.plans (
  id text primary key,
  storage_bytes bigint not null check (storage_bytes > 0),
  max_members int not null check (max_members > 0),
  originals boolean not null default false
);

-- Initial hypothesis (§31). Change these rows, not code.
insert into public.plans (id, storage_bytes, max_members, originals) values
  ('free', 2::bigint * 1024 * 1024 * 1024, 6, false),
  ('plus', 25::bigint * 1024 * 1024 * 1024, 10, true),
  ('family', 100::bigint * 1024 * 1024 * 1024, 30, true);

alter table public.plans enable row level security;
create policy plans_select on public.plans for select to authenticated using (true);

create table public.entitlements (
  family_id uuid primary key references public.families (id) on delete cascade,
  plan_id text not null references public.plans (id),
  source text not null default 'manual' check (source in ('manual', 'google_play', 'app_store')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create policy entitlements_select on public.entitlements for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
-- No write policies: only the billing backend (service role) grants plans.

-- Effective plan: an unexpired entitlement, else free.
create function public.family_plan(fid uuid)
returns public.plans
language sql stable security definer set search_path = ''
as $$
  select p.* from public.plans p
  where p.id = coalesce(
    (select e.plan_id from public.entitlements e
      where e.family_id = fid and (e.expires_at is null or e.expires_at > now())),
    'free');
$$;

-- What the Family screen shows: bytes used, limit, plan.
create function public.family_usage(fid uuid)
returns table (plan_id text, used_bytes bigint, storage_bytes bigint, members int, max_members int)
language sql stable security definer set search_path = ''
as $$
  select p.id,
         coalesce((select sum(a.bytes) from public.memory_assets a where a.family_id = fid), 0)::bigint,
         p.storage_bytes,
         (select count(*)::int from public.family_members m where m.family_id = fid and m.revoked_at is null),
         p.max_members
  from public.family_plan(fid) p
  where public.has_family_role(fid, 'viewer');
$$;

-- Storage quota: a new asset may not push the family over its plan's storage.
create function public.enforce_storage_quota()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  used bigint;
  quota bigint := (public.family_plan(new.family_id)).storage_bytes;
begin
  select coalesce(sum(bytes), 0) into used from public.memory_assets where family_id = new.family_id;
  if used + coalesce(new.bytes, 0) > quota then
    raise exception 'storage quota exceeded' using errcode = '23514', hint = 'upgrade';
  end if;
  return new;
end;
$$;

create trigger memory_assets_quota before insert on public.memory_assets
  for each row execute function public.enforce_storage_quota();

-- Family size: accepting an invite may not exceed the plan's member limit.
create or replace function public.accept_invitation(token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invitations;
  active int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into inv from public.invitations
  where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
  for update;
  if inv.id is null or inv.accepted_at is not null or inv.expires_at <= now() then
    raise exception 'invitation invalid or expired' using errcode = '22023';
  end if;
  select count(*) into active from public.family_members where family_id = inv.family_id and revoked_at is null;
  if active >= (public.family_plan(inv.family_id)).max_members then
    raise exception 'family is full' using errcode = '23514', hint = 'upgrade';
  end if;
  insert into public.family_members (family_id, user_id, role)
  values (inv.family_id, auth.uid(), inv.role)
  on conflict (family_id, user_id) do update
    set role = excluded.role, revoked_at = null
    where public.family_members.revoked_at is not null;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.family_id;
end;
$$;

revoke execute on function public.enforce_storage_quota() from public, anon, authenticated;
revoke execute on function public.family_plan(uuid) from public, anon;
revoke execute on function public.family_usage(uuid) from public, anon;
