-- M4: tracker events follow family roles.
begin;
select plan(7);

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

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$insert into public.tracker_events (id, family_id, baby_id, kind, started_at, data) values ('aaaaaaaa-3333-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', 'feed', now(), '{"method":"bottle","amount_ml":120}')$$, 'owner logs a feed');
select throws_ok($$insert into public.tracker_events (family_id, baby_id, kind, started_at, ended_at) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', 'sleep', now(), now() - interval '1 hour')$$, '23514', null, 'sleep cannot end before it starts');
select throws_ok($$insert into public.tracker_events (family_id, baby_id, kind, started_at) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', 'nap', now())$$, '23514', null, 'unknown kinds are rejected');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.tracker_events), 1, 'viewer reads the log');
select throws_ok($$insert into public.tracker_events (family_id, baby_id, kind, started_at) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', 'diaper', now())$$, '42501', null, 'viewer cannot log');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.tracker_events), 0, 'other family cannot read the log');
prepare b_delete as delete from public.tracker_events returning id;
select is_empty('b_delete', 'other family cannot delete events');

select * from finish();
rollback;
