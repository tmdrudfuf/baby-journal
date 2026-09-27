-- M6: match_memories respects RLS: no other member's private notes, no other family's memories.
begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'partner@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'other@test.local');
insert into public.families (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'A'), ('bbbbbbbb-0000-0000-0000-000000000000', 'B');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'caregiver'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000d', 'owner');
insert into public.babies (id, family_id, name) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('bbbbbbbb-1111-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'B1');
insert into public.memories (id, family_id, baby_id, author_id, raw_text, visibility, embedding) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'shared', 'family', array_fill(0.1::real, array[384])::extensions.vector),
  ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'partner private', 'private', array_fill(0.1::real, array[384])::extensions.vector),
  ('bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000d', 'other family', 'family', array_fill(0.1::real, array[384])::extensions.vector);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select results_eq(
  $$select raw_text from public.match_memories('aaaaaaaa-1111-0000-0000-000000000000', array_fill(0.1::real, array[384])::extensions.vector)$$,
  $$values ('shared')$$, 'owner finds family memories but not the partner''s private note');
select is_empty(
  $$select 1 from public.match_memories('bbbbbbbb-1111-0000-0000-000000000000', array_fill(0.1::real, array[384])::extensions.vector)$$,
  'no results from another family');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.match_memories('aaaaaaaa-1111-0000-0000-000000000000', array_fill(0.1::real, array[384])::extensions.vector)),
  2, 'the author also finds their own private note');

select * from finish();
rollback;
