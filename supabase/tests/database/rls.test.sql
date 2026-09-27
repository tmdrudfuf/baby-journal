-- Security guarantees from masterplan §36. Run: npm run db:test
begin;
select plan(25);

-- ---------------------------------------------------------------- fixtures (as postgres, RLS bypassed)
-- a = owner of A, b = owner of B, v = viewer of A, r = caregiver of A (revoked later), i = invitee
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'v@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'r@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'i@test.local');

insert into public.families (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Family A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Family B');

insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000c', 'viewer'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000d', 'caregiver');

insert into public.babies (id, family_id, name) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Baby A'),
  ('bbbbbbbb-1111-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Baby B');

insert into public.memories (id, family_id, baby_id, author_id, raw_text) values
  ('aaaaaaaa-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'A memory'),
  ('bbbbbbbb-2222-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000',
   'bbbbbbbb-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'B memory');

insert into public.invitations (family_id, role, token_hash, expires_at) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'contributor',
   encode(sha256(convert_to('expired-token', 'UTF8')), 'hex'), now() - interval '1 minute'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'contributor',
   encode(sha256(convert_to('valid-token', 'UTF8')), 'hex'), now() + interval '1 day');

select is((select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-%'), 5, 'profile auto-created for each auth user');

-- ---------------------------------------------------------------- Family A cannot read Family B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.families), 1, 'A sees only its own family');
select is((select count(*)::int from public.memories where family_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 0, 'A cannot read B memories');
select is((select count(*)::int from public.babies where family_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 0, 'A cannot read B babies');
select is((select count(*)::int from public.family_members where family_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 0, 'A cannot read B members');

-- ---------------------------------------------------------------- Family A cannot modify Family B
prepare a_update_b as update public.memories set raw_text = 'hacked' where id = 'bbbbbbbb-2222-0000-0000-000000000000' returning id;
select is_empty('a_update_b', 'A cannot update B memory');
prepare a_delete_b as delete from public.families where id = 'bbbbbbbb-0000-0000-0000-000000000000' returning id;
select is_empty('a_delete_b', 'A cannot delete B family');
select throws_ok(
  $$insert into public.memories (family_id, baby_id, author_id) values ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'A cannot insert memory into B');
select throws_ok(
  $$insert into public.babies (family_id, name) values ('bbbbbbbb-0000-0000-0000-000000000000', 'x')$$,
  '42501', null, 'A cannot insert baby into B');
select throws_ok(
  $$insert into public.memories (family_id, baby_id, author_id) values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a')$$,
  '23503', null, 'A cannot attach memory to B baby');
select throws_ok(
  $$insert into public.memory_assets (memory_id, family_id, object_key, asset_type, mime_type, variant) values ('aaaaaaaa-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'families/bbbbbbbb-0000-0000-0000-000000000000/x.jpg', 'photo', 'image/jpeg', 'display')$$,
  '23514', null, 'asset key must be namespaced by its own family');
select throws_ok(
  $$insert into public.memory_assets (memory_id, family_id, object_key, asset_type, mime_type, variant) values ('aaaaaaaa-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'families/aaaaaaaa-0000-0000-0000-000000000000/memories/aaaaaaaa-3333-0000-0000-000000000000/display.jpg', 'photo', 'image/jpeg', 'display')$$,
  '23514', null, 'asset key must be namespaced by its own memory');
select lives_ok(
  $$insert into public.memory_assets (memory_id, family_id, object_key, asset_type, mime_type, variant) values ('aaaaaaaa-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'families/aaaaaaaa-0000-0000-0000-000000000000/memories/aaaaaaaa-2222-0000-0000-000000000000/display.jpg', 'photo', 'image/jpeg', 'display')$$,
  'A can add asset to own memory');

-- ---------------------------------------------------------------- Viewer cannot write
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select is((select count(*)::int from public.memories), 1, 'viewer reads family memory');
select throws_ok(
  $$insert into public.memories (family_id, baby_id, author_id) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'viewer cannot create memory');
prepare v_update as update public.memories set raw_text = 'x' where id = 'aaaaaaaa-2222-0000-0000-000000000000' returning id;
select is_empty('v_update', 'viewer cannot edit memory');
prepare v_delete as delete from public.memories where id = 'aaaaaaaa-2222-0000-0000-000000000000' returning id;
select is_empty('v_delete', 'viewer cannot delete memory');
select throws_ok($$select public.create_invitation('aaaaaaaa-0000-0000-0000-000000000000', 'viewer')$$, '42501', null, 'viewer cannot invite');

-- ---------------------------------------------------------------- Invitations
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);

select throws_ok($$select public.accept_invitation('expired-token')$$, '22023', null, 'expired invitation fails');
select is(public.accept_invitation('valid-token'), 'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'valid invitation joins family');
select is((select count(*)::int from public.memories), 1, 'invitee now sees family memory');
select throws_ok($$select public.accept_invitation('valid-token')$$, '22023', null, 'invitation cannot be reused');

-- ---------------------------------------------------------------- Revoked members lose access
reset role;
update public.family_members set revoked_at = now()
  where user_id = '00000000-0000-0000-0000-00000000000d';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);

select is((select count(*)::int from public.memories), 0, 'revoked member cannot read memories');
select throws_ok(
  $$insert into public.memories (family_id, baby_id, author_id) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000d')$$,
  '42501', null, 'revoked member cannot write');

-- ---------------------------------------------------------------- Anonymous
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.memories), 0, 'anon sees nothing');

select * from finish();
rollback;
