-- Milestones follow family RLS; AI telemetry is service-only.
begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.families (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'A'), ('bbbbbbbb-0000-0000-0000-000000000000', 'B');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'owner');
insert into public.babies (id, family_id, name) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Baby A');
insert into public.memories (id, family_id, baby_id, author_id, raw_text) values
  ('aaaaaaaa-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'rolled over!');
insert into public.ai_usage (family_id, feature, provider, model, ok)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'journal', 'anthropic', 'claude-opus-5', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.milestones (family_id, baby_id, memory_id, title, occurred_on) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-2222-0000-0000-000000000000', 'First rollover', '2026-09-26')$$,
  'owner saves a milestone from a memory');
select is((select count(*)::int from public.ai_usage), 0, 'AI telemetry is not readable by users');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.milestones), 0, 'other family cannot read milestones');
select throws_ok(
  $$insert into public.milestones (family_id, baby_id, title, occurred_on) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', 'x', '2026-09-26')$$,
  '42501', null, 'other family cannot add milestones');

reset role;
delete from public.memories where id = 'aaaaaaaa-2222-0000-0000-000000000000';
select is((select count(*)::int from public.milestones where family_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 1, 'milestone survives memory deletion');
select is((select memory_id from public.milestones where family_id = 'aaaaaaaa-0000-0000-0000-000000000000'), null::uuid, 'milestone memory link cleared');

select * from finish();
rollback;
