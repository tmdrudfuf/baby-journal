-- M3: comments/reactions RLS, viewer engagement, last-owner protection.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'other@test.local');
insert into public.families (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'A'), ('bbbbbbbb-0000-0000-0000-000000000000', 'B');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000c', 'viewer'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'owner');
insert into public.babies (id, family_id, name) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Baby');
insert into public.memories (id, family_id, baby_id, author_id, visibility) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'family'),
  ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'private');

set local role authenticated;

-- Viewer engages with a family memory.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$insert into public.comments (memory_id, family_id, body) values ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'So cute!')$$, 'viewer can comment');
select lives_ok($$insert into public.reactions (memory_id, family_id) values ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000')$$, 'viewer can react');
select throws_ok($$insert into public.comments (memory_id, family_id, body) values ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'peek')$$, '42501', null, 'cannot comment on a private memory of someone else');
select throws_ok($$insert into public.comments (memory_id, family_id, author_id, body) values ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'fake')$$, '42501', null, 'cannot comment as someone else');

-- Other family sees and writes nothing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.comments), 0, 'other family cannot read comments');
select is((select count(*)::int from public.reactions), 0, 'other family cannot read reactions');
select throws_ok($$insert into public.reactions (memory_id, family_id) values ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000')$$, '42501', null, 'other family cannot react');

-- Last owner cannot leave or be demoted.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$delete from public.family_members where user_id = '00000000-0000-0000-0000-00000000000a'$$, '23514', null, 'last owner cannot leave');
select throws_ok($$update public.family_members set role = 'caregiver' where user_id = '00000000-0000-0000-0000-00000000000a'$$, '23514', null, 'last owner cannot demote themselves');
select lives_ok($$update public.family_members set revoked_at = now() where user_id = '00000000-0000-0000-0000-00000000000c'$$, 'owner can revoke a viewer');
select lives_ok($$delete from public.families where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$, 'owner can still delete the whole family');

select * from finish();
rollback;
