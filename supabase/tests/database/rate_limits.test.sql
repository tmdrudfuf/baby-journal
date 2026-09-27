begin;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select ok(public.hit_rate_limit('upload', 2, 3600), 'first hit allowed');
select ok(public.hit_rate_limit('upload', 2, 3600), 'second hit allowed');
select ok(not public.hit_rate_limit('upload', 2, 3600), 'third hit in the window refused');
select ok(public.hit_rate_limit('export', 2, 3600), 'buckets are independent');
select is((select count(*)::int from public.rate_limits), 0, 'users cannot read the limiter table');

select * from finish();
rollback;
