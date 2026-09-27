-- M5: family members read daily stories; viewers cannot change them; nobody inserts directly.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@test.local');
insert into public.families (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'A');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000c', 'viewer');
insert into public.babies (id, family_id, name) values ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'B');
insert into public.daily_stories (baby_id, family_id, day, story_text) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', '2026-09-26', 'A day.');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is_empty('select 1 from public.daily_stories', 'outsider sees nothing');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
prepare v_upd as update public.daily_stories set story_text = 'hacked' returning day;
select is_empty('v_upd', 'viewer cannot change the story');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.daily_stories (baby_id, family_id, day) values ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', '2026-09-27')$$,
  '42501', null, 'members cannot insert stories directly');
update public.daily_stories set saved = true, edited = true, story_text = 'Our words.';
select is((select story_text from public.daily_stories), 'Our words.', 'owner saves an edited story');

select * from finish();
rollback;
