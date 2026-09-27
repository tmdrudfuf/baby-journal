-- Deleting memories or whole families queues their R2 objects for removal.
begin;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.families (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'A');
insert into public.family_members (family_id, user_id, role)
  values ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner');
insert into public.babies (id, family_id, name)
  values ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Baby');
insert into public.memories (id, family_id, baby_id, author_id) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a'),
  ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a');
insert into public.memory_assets (memory_id, family_id, object_key, asset_type, mime_type, variant) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000',
   'families/aaaaaaaa-0000-0000-0000-000000000000/memories/aaaaaaaa-2222-0000-0000-000000000001/display.jpg', 'photo', 'image/jpeg', 'display'),
  ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000',
   'families/aaaaaaaa-0000-0000-0000-000000000000/memories/aaaaaaaa-2222-0000-0000-000000000002/display.jpg', 'photo', 'image/jpeg', 'display');

-- Owner deletes one memory under RLS.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
delete from public.memories where id = 'aaaaaaaa-2222-0000-0000-000000000001';
select is((select count(*)::int from public.media_deletions), 0, 'authenticated users cannot read the deletion queue');
reset role;

select is((select count(*)::int from public.media_deletions), 1, 'memory delete queues its object');

delete from public.families where id = 'aaaaaaaa-0000-0000-0000-000000000000';
select is((select count(*)::int from public.media_deletions), 2, 'family delete queues remaining objects');
select ok(
  exists (select 1 from public.media_deletions where object_key like '%000000000002/display.jpg'),
  'queued key matches deleted asset');

select * from finish();
rollback;
