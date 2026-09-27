-- Milestone 0: core schema + RLS foundation.
-- Every family-scoped policy routes through public.has_family_role() (SECURITY DEFINER)
-- so policies never query family_members under RLS (avoids recursive policies).

-- Declaration order defines rank: viewer < contributor < caregiver < owner.
create type public.family_role as enum ('viewer', 'contributor', 'caregiver', 'owner');

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.family_role not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (family_id, user_id)
);
create index family_members_user_idx on public.family_members (user_id) where revoked_at is null;

create table public.babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  birth_date date,
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

-- id may be generated on the device so offline retries are idempotent (§28, §33).
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  baby_id uuid not null,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  type text not null default 'moment'
    check (type in ('moment', 'photo', 'video', 'voice', 'note', 'milestone')),
  raw_text text check (char_length(raw_text) <= 10000),
  story_text text check (char_length(story_text) <= 10000),
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  milestone_candidate boolean not null default false,
  -- Baby must belong to the same family as the memory.
  foreign key (baby_id, family_id) references public.babies (id, family_id) on delete cascade,
  unique (id, family_id)
);
create index memories_timeline_idx on public.memories (family_id, occurred_at desc);

-- Media bytes live in R2; this row is metadata + authorization anchor (§27, §35).
create table public.memory_assets (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null,
  family_id uuid not null,
  object_key text not null unique,
  asset_type text not null check (asset_type in ('photo', 'video', 'audio')),
  mime_type text not null,
  variant text not null check (variant in ('thumbnail', 'display', 'original', 'poster', 'playback')),
  storage_class text not null default 'hot' check (storage_class in ('hot', 'warm', 'archive')),
  width int,
  height int,
  duration_ms int,
  bytes bigint check (bytes >= 0),
  hash text,
  created_at timestamptz not null default now(),
  foreign key (memory_id, family_id) references public.memories (id, family_id) on delete cascade,
  -- Keys are always namespaced by family.
  check (object_key like 'families/' || family_id::text || '/%'),
  unique (memory_id, variant)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  role public.family_role not null check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

create function public.has_family_role(fid uuid, min_role public.family_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid
      and user_id = auth.uid()
      and revoked_at is null
      and role >= min_role
  );
$$;

-- Same rule as memories update/delete; shared by asset policies and media-sign.
create function public.can_edit_memory(mid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memories m
    where m.id = mid
      and public.has_family_role(m.family_id, 'contributor')
      and (m.author_id = auth.uid() or public.has_family_role(m.family_id, 'caregiver'))
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger memories_touch before update on public.memories
  for each row execute function public.touch_updated_at();

-- Creates a family and makes the caller its owner, atomically.
create function public.create_family(family_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.families (name, created_by) values (family_name, auth.uid()) returning id into fid;
  insert into public.family_members (family_id, user_id, role) values (fid, auth.uid(), 'owner');
  return fid;
end;
$$;

-- Returns the raw token once; only its SHA-256 is stored.
create function public.create_invitation(fid uuid, invite_role public.family_role, ttl interval default interval '7 days')
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.has_family_role(fid, 'caregiver') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if invite_role = 'owner' then
    raise exception 'cannot invite as owner' using errcode = '22023';
  end if;
  if ttl > interval '30 days' or ttl <= interval '0' then
    raise exception 'invalid ttl' using errcode = '22023';
  end if;
  insert into public.invitations (family_id, role, token_hash, invited_by, expires_at)
  values (fid, invite_role, encode(sha256(convert_to(token, 'UTF8')), 'hex'), auth.uid(), now() + ttl);
  return token;
end;
$$;

create function public.accept_invitation(token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invitations;
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
  insert into public.family_members (family_id, user_id, role)
  values (inv.family_id, auth.uid(), inv.role)
  on conflict (family_id, user_id) do update
    set role = excluded.role, revoked_at = null
    where public.family_members.revoked_at is not null;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.family_id;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_family(text) from public, anon;
revoke execute on function public.create_invitation(uuid, public.family_role, interval) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.babies enable row level security;
alter table public.memories enable row level security;
alter table public.memory_assets enable row level security;
alter table public.invitations enable row level security;

-- profiles: self, plus people who share an active family with me.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (select 1 from public.family_members fm where fm.user_id = profiles.id and fm.revoked_at is null)
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- families: created via create_family() only.
create policy families_select on public.families for select to authenticated
  using (public.has_family_role(id, 'viewer'));
create policy families_update on public.families for update to authenticated
  using (public.has_family_role(id, 'owner')) with check (public.has_family_role(id, 'owner'));
create policy families_delete on public.families for delete to authenticated
  using (public.has_family_role(id, 'owner'));

-- family_members: joined via create_family()/accept_invitation() only.
create policy members_select on public.family_members for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
create policy members_update on public.family_members for update to authenticated
  using (public.has_family_role(family_id, 'owner')) with check (public.has_family_role(family_id, 'owner'));
create policy members_delete on public.family_members for delete to authenticated
  using (public.has_family_role(family_id, 'owner') or user_id = auth.uid());

create policy babies_select on public.babies for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
create policy babies_insert on public.babies for insert to authenticated
  with check (public.has_family_role(family_id, 'caregiver'));
create policy babies_update on public.babies for update to authenticated
  using (public.has_family_role(family_id, 'caregiver')) with check (public.has_family_role(family_id, 'caregiver'));
create policy babies_delete on public.babies for delete to authenticated
  using (public.has_family_role(family_id, 'owner'));

create policy memories_select on public.memories for select to authenticated
  using (public.has_family_role(family_id, 'viewer') and (visibility = 'family' or author_id = auth.uid()));
create policy memories_insert on public.memories for insert to authenticated
  with check (public.has_family_role(family_id, 'contributor') and author_id = auth.uid());
create policy memories_update on public.memories for update to authenticated
  using (
    public.has_family_role(family_id, 'contributor')
    and (author_id = auth.uid() or public.has_family_role(family_id, 'caregiver'))
  )
  with check (
    public.has_family_role(family_id, 'contributor')
    and (author_id = auth.uid() or public.has_family_role(family_id, 'caregiver'))
  );
create policy memories_delete on public.memories for delete to authenticated
  using (
    public.has_family_role(family_id, 'contributor')
    and (author_id = auth.uid() or public.has_family_role(family_id, 'caregiver'))
  );

-- Asset rows follow their memory's visibility; writes follow memory edit rights.
create policy assets_select on public.memory_assets for select to authenticated
  using (exists (select 1 from public.memories m where m.id = memory_id));
create policy assets_insert on public.memory_assets for insert to authenticated
  with check (public.can_edit_memory(memory_id));
create policy assets_delete on public.memory_assets for delete to authenticated
  using (public.can_edit_memory(memory_id));

-- invitations: created/accepted via functions; caregivers can list and revoke.
create policy invitations_select on public.invitations for select to authenticated
  using (public.has_family_role(family_id, 'caregiver'));
create policy invitations_delete on public.invitations for delete to authenticated
  using (public.has_family_role(family_id, 'caregiver'));
