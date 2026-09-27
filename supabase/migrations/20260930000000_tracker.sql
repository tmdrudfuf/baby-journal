-- Milestone 4: tracker events (feed, sleep, diaper, growth). Same access rules as memories.
-- id may be generated on the device so offline retries are idempotent.
create table public.tracker_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  baby_id uuid not null,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  kind text not null check (kind in ('feed', 'sleep', 'diaper', 'growth')),
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at is null or ended_at >= started_at),
  -- feed: {method: breast|bottle|solid, side?: left|right, amount_ml?}; diaper: {type: wet|dirty|both};
  -- growth: {weight_kg?, height_cm?, head_cm?}
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 2048),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (baby_id, family_id) references public.babies (id, family_id) on delete cascade
);
create index tracker_events_timeline_idx on public.tracker_events (baby_id, started_at desc);

create trigger tracker_events_touch before update on public.tracker_events
  for each row execute function public.touch_updated_at();

alter table public.tracker_events enable row level security;
create policy tracker_select on public.tracker_events for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
create policy tracker_insert on public.tracker_events for insert to authenticated
  with check (public.has_family_role(family_id, 'contributor') and author_id = auth.uid());
create policy tracker_update on public.tracker_events for update to authenticated
  using (
    public.has_family_role(family_id, 'contributor')
    and (author_id = auth.uid() or public.has_family_role(family_id, 'caregiver'))
  )
  with check (public.has_family_role(family_id, 'contributor'));
create policy tracker_delete on public.tracker_events for delete to authenticated
  using (
    public.has_family_role(family_id, 'contributor')
    and (author_id = auth.uid() or public.has_family_role(family_id, 'caregiver'))
  );

alter publication supabase_realtime add table public.tracker_events;
