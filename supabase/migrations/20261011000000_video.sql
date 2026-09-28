-- Video memories (owner decision 2026-09-28): a paid-plan feature because clips need far more storage.
-- Only new video uploads are gated; existing videos stay playable and downloadable on any plan.
alter table public.plans add column video boolean not null default false;
update public.plans set video = true where id in ('plus', 'family');
