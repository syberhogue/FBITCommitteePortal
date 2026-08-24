begin;
select plan(9);

select has_column('public', 'committees', 'color', 'committees have an assigned colour');

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select lives_ok(
  $$update public.committees set color = '#E75D2A'
    where id = '10000000-0000-0000-0000-000000000001'$$,
  'committee Staff can choose a committee colour'
);
select throws_ok(
  $$update public.committees set name = 'Staff renamed committee'
    where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Committee Staff may only change the committee colour.',
  'committee Staff cannot change other committee fields'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
update public.committees set color = '#6F2C91'
where id = '10000000-0000-0000-0000-000000000001';
select is(
  (select color from public.committees where id = '10000000-0000-0000-0000-000000000001'),
  '#E75D2A',
  'ordinary members cannot change committee colours'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.activity_log),
  0::bigint,
  'a dean sees no activity without committee membership'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select ok(
  (select count(*) from public.activity_log) > 0,
  'committee Staff see activity for their assigned committees'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select ok((select count(*) from public.activity_log) > 0, 'administrators see all activity');
select lives_ok(
  $$delete from public.committees where id = '10000000-0000-0000-0000-000000000002'$$,
  'committee delete writes audit activity without violating activity_log committee FK'
);
select ok(
  exists (
    select 1
    from public.activity_log
    where event_type = 'committees.delete'
      and entity_id = '10000000-0000-0000-0000-000000000002'
      and committee_id is null
      and details ->> 'committee_id' = '10000000-0000-0000-0000-000000000002'
  ),
  'committee delete audit keeps the deleted committee id in details'
);

select * from finish();
rollback;
