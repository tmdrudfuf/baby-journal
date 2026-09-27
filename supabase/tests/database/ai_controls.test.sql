-- M2: only owners switch AI off; viewers cannot edit suggestions.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@test.local');
insert into public.families (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'A');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000c', 'viewer');
insert into public.babies (id, family_id, name) values ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'B');
insert into public.memories (id, family_id, baby_id, author_id, raw_text, story_text) values
  ('aaaaaaaa-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'note', 'suggested');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
prepare v_ai as update public.families set ai_enabled = false returning id;
select is_empty('v_ai', 'viewer cannot switch AI off');
prepare v_story as update public.memories set story_text = 'hacked', story_edited = true returning id;
select is_empty('v_story', 'viewer cannot edit a suggestion');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
update public.families set ai_enabled = false;
select is((select ai_enabled from public.families), false, 'owner switches AI off');
update public.memories set story_text = 'my words', story_edited = true;
select is((select story_text from public.memories), 'my words', 'author edits the suggestion');

select * from finish();
rollback;
