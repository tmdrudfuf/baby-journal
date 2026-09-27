-- M5: Daily Story (§14). One optional narrative per baby per day, written by the ai-journal function
-- (service role) and saved/edited/discarded by the family.
create table public.daily_stories (
  baby_id uuid not null,
  family_id uuid not null,
  day date not null,
  story_text text check (char_length(story_text) <= 2000),
  saved boolean not null default false,
  edited boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (baby_id, day),
  foreign key (baby_id, family_id) references public.babies (id, family_id) on delete cascade
);

alter table public.daily_stories enable row level security;
create policy daily_stories_select on public.daily_stories for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
-- Suggestions are created by the edge function; members only decide what to keep.
create policy daily_stories_update on public.daily_stories for update to authenticated
  using (public.has_family_role(family_id, 'contributor')) with check (public.has_family_role(family_id, 'contributor'));
create policy daily_stories_delete on public.daily_stories for delete to authenticated
  using (public.has_family_role(family_id, 'contributor'));
