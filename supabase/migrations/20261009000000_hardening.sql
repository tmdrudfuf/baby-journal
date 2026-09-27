-- M10 audit fixes.

-- Security: authorization helpers are for signed-in users (RLS) only; anonymous callers never need them.
revoke execute on function public.has_family_role(uuid, public.family_role) from public, anon;
revoke execute on function public.can_edit_memory(uuid) from public, anon;
revoke execute on function public.ensure_family_owner() from public, anon, authenticated; -- trigger only
grant execute on function public.has_family_role(uuid, public.family_role) to authenticated, service_role;
grant execute on function public.can_edit_memory(uuid) to authenticated, service_role;

-- Performance: the app pulls a baby's journal newest-first; Ask and Daily Story filter by baby too.
create index memories_baby_timeline_idx on public.memories (baby_id, occurred_at desc);
-- Family screen lists pending invites; account deletion rewrites a user's rows.
create index invitations_family_idx on public.invitations (family_id);
create index memories_author_idx on public.memories (author_id);
create index comments_author_idx on public.comments (author_id);
create index reactions_user_idx on public.reactions (user_id);
