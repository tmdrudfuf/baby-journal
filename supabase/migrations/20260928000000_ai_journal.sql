-- Milestone 2: AI journal suggestions, milestones, AI cost telemetry.
-- AI output is always a suggestion next to the parent's original text (raw_text is never modified).

alter table public.memories
  add column milestone_title text check (char_length(milestone_title) <= 120),
  add column ai_status text check (ai_status in ('done', 'failed', 'skipped')),
  add column ai_input_hash text; -- skip re-processing unchanged text (§39 cache)

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  baby_id uuid not null,
  memory_id uuid unique,
  title text not null check (char_length(title) between 1 and 120),
  occurred_on date not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (baby_id, family_id) references public.babies (id, family_id) on delete cascade,
  foreign key (memory_id, family_id) references public.memories (id, family_id) on delete set null (memory_id)
);
create index milestones_baby_idx on public.milestones (baby_id, occurred_on);

alter table public.milestones enable row level security;
create policy milestones_select on public.milestones for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (public.has_family_role(family_id, 'contributor') and created_by = auth.uid());
create policy milestones_update on public.milestones for update to authenticated
  using (public.has_family_role(family_id, 'contributor')) with check (public.has_family_role(family_id, 'contributor'));
create policy milestones_delete on public.milestones for delete to authenticated
  using (public.has_family_role(family_id, 'contributor'));

-- Cost telemetry (§39). Written by edge functions with the service role only.
create table public.ai_usage (
  id bigint generated always as identity primary key,
  family_id uuid references public.families (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  feature text not null,
  provider text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  latency_ms int not null default 0,
  est_cost_usd numeric(10, 6) not null default 0,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index ai_usage_family_day_idx on public.ai_usage (family_id, created_at);
alter table public.ai_usage enable row level security; -- no policies: service role only
