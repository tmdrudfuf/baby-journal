-- M8: store purchases drive entitlements; clients cannot touch either; a lapsed plan never hides memories.
begin;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'owner@test.local');
insert into public.families (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'A'), ('bbbbbbbb-0000-0000-0000-000000000000', 'B');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner');
insert into public.babies (id, family_id, name) values ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'B');
insert into public.memories (id, family_id, baby_id, author_id, raw_text) values
  ('aaaaaaaa-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'kept');

insert into public.purchases (purchase_token, family_id, user_id, provider, product_id, state, expires_at) values
  ('t1', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'mock', 'plus_monthly', 'active', now() + interval '10 days');
select public.sync_store_entitlement('aaaaaaaa-0000-0000-0000-000000000000');
select is((public.family_plan('aaaaaaaa-0000-0000-0000-000000000000')).id, 'plus', 'active purchase grants its plan');
select ok((public.family_plan('aaaaaaaa-0000-0000-0000-000000000000')).ai_ask, 'plus includes Ask');

update public.purchases set state = 'canceled';
select public.sync_store_entitlement('aaaaaaaa-0000-0000-0000-000000000000');
select is((public.family_plan('aaaaaaaa-0000-0000-0000-000000000000')).id, 'plus', 'canceled keeps the plan until the paid period ends');

update public.purchases set state = 'expired', expires_at = now() - interval '1 day';
select public.sync_store_entitlement('aaaaaaaa-0000-0000-0000-000000000000');
select is((public.family_plan('aaaaaaaa-0000-0000-0000-000000000000')).id, 'free', 'lapsed purchase falls back to free');

insert into public.entitlements (family_id, plan_id, source) values ('bbbbbbbb-0000-0000-0000-000000000000', 'family', 'manual');
insert into public.purchases (purchase_token, family_id, provider, product_id, state, expires_at) values
  ('t2', 'bbbbbbbb-0000-0000-0000-000000000000', 'mock', 'plus_monthly', 'expired', now() - interval '1 day');
select public.sync_store_entitlement('bbbbbbbb-0000-0000-0000-000000000000');
select is((select plan_id from public.entitlements where family_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'family', 'manual grants are never touched');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select raw_text from public.memories), 'kept', 'memories stay readable after the plan lapses');
select is_empty('select 1 from public.purchases', 'purchases are invisible to clients');
select throws_ok($$insert into public.entitlements (family_id, plan_id) values ('aaaaaaaa-0000-0000-0000-000000000000', 'family')$$, '42501', null, 'clients cannot grant plans');
select throws_ok($$select public.sync_store_entitlement('aaaaaaaa-0000-0000-0000-000000000000')$$, '42501', null, 'clients cannot recompute entitlements');

select * from finish();
rollback;
