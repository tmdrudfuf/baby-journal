-- Milestone 3: comments, reactions, last-owner protection, realtime.
-- Product decision (documented in docs/DATABASE.md): viewers (e.g. grandparents) may react and
-- comment, but only contributors+ create memories.

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null,
  family_id uuid not null,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (memory_id, family_id) references public.memories (id, family_id) on delete cascade
);
create index comments_memory_idx on public.comments (memory_id, created_at);

create table public.reactions (
  memory_id uuid not null,
  family_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null default 'heart' check (kind in ('heart')),
  created_at timestamptz not null default now(),
  primary key (memory_id, user_id, kind),
  foreign key (memory_id, family_id) references public.memories (id, family_id) on delete cascade
);

alter table public.comments enable row level security;
alter table public.reactions enable row level security;

-- Visible when the memory is visible (memories RLS applies inside the subquery).
create policy comments_select on public.comments for select to authenticated
  using (exists (select 1 from public.memories m where m.id = memory_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.has_family_role(family_id, 'viewer')
    and exists (select 1 from public.memories m where m.id = memory_id)
  );
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.has_family_role(family_id, 'caregiver'));

create policy reactions_select on public.reactions for select to authenticated
  using (exists (select 1 from public.memories m where m.id = memory_id));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_family_role(family_id, 'viewer')
    and exists (select 1 from public.memories m where m.id = memory_id)
  );
create policy reactions_delete on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- A family must always keep an active owner (unless the family itself is being deleted).
create function public.ensure_family_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.families where id = old.family_id) then
    return null; -- family delete cascade
  end if;
  if not exists (
    select 1 from public.family_members
    where family_id = old.family_id and role = 'owner' and revoked_at is null
  ) then
    raise exception 'a family needs at least one owner' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger family_members_keep_owner
  after update or delete on public.family_members
  deferrable initially immediate
  for each row execute function public.ensure_family_owner();

-- Owners manage roles; nobody can grant ownership except an owner (policy already owner-only).

-- Realtime: clients refresh when family data changes. RLS still filters what each user receives.
alter publication supabase_realtime add table public.memories, public.comments, public.reactions;

-- Let the API embed display names ("Recorded by Dad"). Profiles exist for every auth user (trigger).
alter table public.family_members
  add constraint family_members_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.memories
  add constraint memories_author_profile_fk foreign key (author_id) references public.profiles (id) on delete set null;
alter table public.comments
  add constraint comments_author_profile_fk foreign key (author_id) references public.profiles (id) on delete set null;
