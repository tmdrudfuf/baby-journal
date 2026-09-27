-- M6: AI memory search. Embeddings come from the edge runtime's built-in gte-small model (384 dims).
create extension if not exists vector with schema extensions;

alter table public.memories
  add column embedding extensions.vector(384),
  add column embedded_hash text; -- sha256 of the embedded text: re-embed when the note changes

-- ponytail: no ANN index. An HNSW/IVF index picks nearest rows across all families before the baby_id
-- filter and RLS apply, so a baby's own memories could be missed. Exact scan per baby is fine at journal
-- sizes; switch to an index with iterative scans if one baby reaches tens of thousands of memories.
create index memories_baby_embedded_idx on public.memories (baby_id) where embedding is not null;

-- SECURITY INVOKER: memories RLS applies, so private notes of other members and other families never match.
create function public.match_memories(bid uuid, query extensions.vector(384), k int default 8)
returns table (id uuid, raw_text text, story_text text, occurred_at timestamptz, similarity double precision)
language sql stable security invoker set search_path = public, extensions
as $$
  select m.id, m.raw_text, m.story_text, m.occurred_at, 1 - (m.embedding <=> query)
  from public.memories m
  where m.baby_id = bid and m.embedding is not null
  order by m.embedding <=> query
  limit least(greatest(k, 1), 20);
$$;
