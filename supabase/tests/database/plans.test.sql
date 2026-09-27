-- M8: plans, entitlements, storage quota, member limit.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'joiner@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'other@test.local');
insert into public.families (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'A');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner');
insert into public.babies (id, family_id, name) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Baby');
insert into public.memories (id, family_id, baby_id, author_id) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a'),
  ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a');

-- Tiny test plan so the quota is easy to hit.
insert into public.plans (id, storage_bytes, max_members) values ('tiny', 1000, 1);
insert into public.entitlements (family_id, plan_id) values ('aaaaaaaa-0000-0000-0000-000000000000', 'tiny');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select plan_id from public.family_usage('aaaaaaaa-0000-0000-0000-000000000000')), 'tiny', 'entitlement sets the plan');
select lives_ok($$insert into public.memory_assets (memory_id, family_id, object_key, asset_type, mime_type, variant, bytes) values ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'families/aaaaaaaa-0000-0000-0000-000000000000/memories/aaaaaaaa-2222-0000-0000-000000000001/display.jpg', 'photo', 'image/jpeg', 'display', 800)$$, 'upload within quota');
select throws_ok($$insert into public.memory_assets (memory_id, family_id, object_key, asset_type, mime_type, variant, bytes) values ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'families/aaaaaaaa-0000-0000-0000-000000000000/memories/aaaaaaaa-2222-0000-0000-000000000002/display.jpg', 'photo', 'image/jpeg', 'display', 300)$$, '23514', 'storage quota exceeded', 'upload over quota refused');
select is((select used_bytes from public.family_usage('aaaaaaaa-0000-0000-0000-000000000000')), 800::bigint, 'usage counts stored bytes');
select throws_ok($$insert into public.entitlements (family_id, plan_id) values ('aaaaaaaa-0000-0000-0000-000000000000', 'family')$$, '42501', null, 'users cannot grant themselves a plan');

-- Member limit (tiny plan: 1 member, already full).
select public.create_invitation('aaaaaaaa-0000-0000-0000-000000000000', 'viewer') as code \gset
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(format('select public.accept_invitation(%L)', :'code'), '23514', 'family is full', 'full family refuses a new member');

-- Expired entitlement falls back to free (6 members).
reset role;
update public.entitlements set expires_at = now() - interval '1 day';
set local role authenticated;
select lives_ok(format('select public.accept_invitation(%L)', :'code'), 'after expiry the free plan applies and the member can join');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.family_usage('aaaaaaaa-0000-0000-0000-000000000000')), 0, 'outsiders see no usage');
select is((select count(*)::int from public.entitlements), 0, 'outsiders see no entitlements');

select * from finish();
rollback;
