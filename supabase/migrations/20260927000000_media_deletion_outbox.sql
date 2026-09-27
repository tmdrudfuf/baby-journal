-- Any removal of an asset row (memory, baby or family delete all cascade here) queues its
-- R2 object for deletion. media-sign `purge` drains the queue (§37, §52).
create table public.media_deletions (
  object_key text primary key,
  created_at timestamptz not null default now()
);

-- No policies: only the service role (edge function) reads or deletes these rows.
alter table public.media_deletions enable row level security;

create function public.queue_media_deletion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.media_deletions (object_key) values (old.object_key) on conflict do nothing;
  return old;
end;
$$;

revoke execute on function public.queue_media_deletion() from public, anon, authenticated;

create trigger memory_assets_queue_deletion
  after delete on public.memory_assets
  for each row execute function public.queue_media_deletion();
