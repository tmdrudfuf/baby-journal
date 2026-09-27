-- M2 completion: family-level AI switch (§38) and protection of parent-edited suggestions (§13).
alter table public.families add column ai_enabled boolean not null default true;
-- true once a parent edits the suggested story; AI never overwrites it after that (only on explicit regenerate).
alter table public.memories add column story_edited boolean not null default false;
