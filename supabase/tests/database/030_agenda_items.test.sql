begin;
select plan(15);

select has_table('public', 'agenda_template_items', 'agenda template items table exists');
select has_table('public', 'agenda_template_item_assignees', 'template item assignees table exists');
select has_table('public', 'meeting_agenda_items', 'meeting agenda items table exists');
select has_table('public', 'meeting_agenda_item_assignees', 'meeting agenda assignees table exists');
select has_function(
  'public',
  'set_agenda_item_completion',
  array['uuid', 'boolean', 'text'],
  'agenda completion RPC exists'
);

insert into public.committees (id, name, mandate, created_by) values (
  '92000000-0000-4000-8000-000000000001',
  'Agenda test committee',
  'Transaction-local agenda workflow test.',
  '00000000-0000-0000-0000-000000000001'
);
insert into public.committee_members (committee_id, profile_id, role_id)
select
  '92000000-0000-4000-8000-000000000001',
  membership.profile_id,
  role.id
from (values
  ('00000000-0000-0000-0000-000000000003'::uuid, 'Chair'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'Staff'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'Member')
) as membership(profile_id, role_name)
join public.committee_roles role on role.name = membership.role_name;
insert into public.meetings (
  id, committee_id, title, starts_at, status, agenda, goals, created_by
) values (
  '92000000-0000-4000-8000-000000000002',
  '92000000-0000-4000-8000-000000000001',
  'Agenda workflow meeting',
  '2033-01-10 10:00:00-05',
  'planned',
  '1. Welcome',
  '{"type":"doc","content":[]}',
  '00000000-0000-0000-0000-000000000004'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select lives_ok(
  $$insert into public.meeting_agenda_items (id, meeting_id, title, sort_order)
    values (
      '92000000-0000-4000-8000-000000000003',
      '92000000-0000-4000-8000-000000000002',
      'Welcome',
      10
    )$$,
  'committee Staff can add a planned agenda item'
);
select lives_ok(
  $$insert into public.meeting_agenda_item_assignees (agenda_item_id, profile_id) values
    ('92000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000003'),
    ('92000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000005')$$,
  'an agenda item supports multiple global personnel assignments'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.meeting_agenda_items
    where meeting_id = '92000000-0000-4000-8000-000000000002'),
  0::bigint,
  'members cannot see agenda items for an unfinalized plan'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
update public.meetings
set status = 'scheduled', finalized_at = now(), finalized_by = '00000000-0000-0000-0000-000000000003'
where id = '92000000-0000-4000-8000-000000000002';
update public.meetings
set status = 'in_progress', started_at = now()
where id = '92000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.meeting_agenda_items
    where meeting_id = '92000000-0000-4000-8000-000000000002'),
  1::bigint,
  'members can see agenda items after the meeting is finalized'
);
select is(
  (select count(*) from public.meeting_agenda_item_assignees
    where agenda_item_id = '92000000-0000-4000-8000-000000000003'),
  2::bigint,
  'members can see all agenda-item assignments'
);
select throws_ok(
  $$select public.set_agenda_item_completion(
    '92000000-0000-4000-8000-000000000003',
    true,
    '{"type":"doc","content":[]}'
  )$$,
  '42501',
  'Only committee Staff or Chairs can check agenda items during an active meeting.',
  'members cannot check off agenda items'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.set_agenda_item_completion(
    '92000000-0000-4000-8000-000000000003',
    true,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"[Agenda 1: Welcome — checked at 10:15 a.m.]"}]}]}'
  )$$,
  'Staff can check an agenda item and persist its minutes marker'
);
select ok(
  (select completed_at is not null from public.meeting_agenda_items
    where id = '92000000-0000-4000-8000-000000000003'),
  'checking an agenda item records a completion time'
);
select matches(
  (select minutes from public.meetings where id = '92000000-0000-4000-8000-000000000002'),
  'Agenda 1: Welcome',
  'the marker is persisted in meeting minutes'
);

update public.meetings set status = 'completed'
where id = '92000000-0000-4000-8000-000000000002';
select throws_ok(
  $$update public.meeting_agenda_items set title = 'Changed after completion'
    where id = '92000000-0000-4000-8000-000000000003'$$,
  '23514',
  'Agenda items can only be changed while planning or while the meeting is in progress.',
  'completed-meeting agenda items are locked'
);

select * from finish();
rollback;
