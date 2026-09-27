-- Per-user fixed-window rate limits for edge functions (§36, §42 cost guardrails).
create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket)
);
alter table public.rate_limits enable row level security; -- no policies: only the function below

-- Counts one hit for the caller; returns false once `max_hits` is exceeded in the current window.
create function public.hit_rate_limit(bucket_name text, max_hits int, window_seconds int)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  now_window timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  n int;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into public.rate_limits as r (user_id, bucket, window_start, hits)
  values (auth.uid(), bucket_name, now_window, 1)
  on conflict (user_id, bucket) do update
    set hits = case when r.window_start = now_window then r.hits + 1 else 1 end,
        window_start = now_window
  returning hits into n;
  return n <= max_hits;
end;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon;
