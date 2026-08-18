begin;
select plan(13);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'committees', 'committees table exists');
select has_function('public', 'search_portal', array['text'], 'search RPC exists');
select is((select relrowsecurity from pg_class where oid = 'public.committees'::regclass), true, 'committee RLS is enabled');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.committees), 2::bigint, 'admin sees every committee');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.committees), 2::bigint, 'dean sees every committee');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*) from public.committees), 1::bigint, 'chair sees assigned committee');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is((select count(*) from public.committees), 2::bigint, 'assigned staff sees assigned committees');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select count(*) from public.committees), 1::bigint, 'member sees assigned committee');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is((select count(*) from public.committees), 0::bigint, 'unassigned active user sees no committees');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select is((select count(*) from public.committees), 0::bigint, 'pending user sees no committees');
select is((select count(*) from public.profiles), 1::bigint, 'pending user sees only own profile');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
select is((select count(*) from public.committees), 0::bigint, 'suspended user sees no committees');

select * from finish();
rollback;
