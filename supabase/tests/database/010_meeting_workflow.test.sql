begin;
select plan(18);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select lives_ok(
  $$insert into public.meetings (
      id, committee_id, title, starts_at, status, agenda, goals, created_by
    ) values (
      '90000000-0000-4000-8000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'Workflow test meeting',
      '2032-09-18 10:00:00-04',
      'planned',
      '{"type":"doc","content":[]}',
      '{"type":"doc","content":[]}',
      '00000000-0000-0000-0000-000000000004'
    )$$,
  'committee Staff can submit a meeting plan'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.meetings where id = '90000000-0000-4000-8000-000000000001'),
  0::bigint,
  'ordinary committee members cannot see unfinalized plans'
);
select throws_ok(
  $$insert into public.meetings (
      committee_id, title, starts_at, status, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'Unauthorized plan',
      '2032-09-19 10:00:00-04',
      'planned',
      '00000000-0000-0000-0000-000000000005'
    )$$,
  '42501',
  'new row violates row-level security policy for table "meetings"',
  'ordinary members cannot plan meetings'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select throws_ok(
  $$update public.meetings
    set status = 'scheduled',
        finalized_at = now(),
        finalized_by = '00000000-0000-0000-0000-000000000004'
    where id = '90000000-0000-4000-8000-000000000001'$$,
  '42501',
  'Only the committee Chair can finalize a meeting plan.',
  'committee Staff cannot finalize plans'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select lives_ok(
  $$update public.meetings
    set status = 'scheduled',
        finalized_at = now(),
        finalized_by = '00000000-0000-0000-0000-000000000003'
    where id = '90000000-0000-4000-8000-000000000001'$$,
  'committee Chair can finalize a meeting plan'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
select is(
  (select status from public.meetings where id = '90000000-0000-4000-8000-000000000001'),
  'scheduled'::public.meeting_status,
  'members can see a finalized scheduled meeting'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select lives_ok(
  $$update public.meetings
    set status = 'in_progress', started_at = now()
    where id = '90000000-0000-4000-8000-000000000001'$$,
  'committee Chair can start a scheduled meeting'
);
select lives_ok(
  $$insert into public.meeting_attendance (
      meeting_id, profile_id, present, marked_at, marked_by
    ) values (
      '90000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000005',
      true,
      now(),
      '00000000-0000-0000-0000-000000000003'
    )$$,
  'attendance can be recorded while a meeting is in progress'
);
select lives_ok(
  $$insert into public.action_items (meeting_id, task, created_by)
    values (
      '90000000-0000-4000-8000-000000000001',
      'Workflow action',
      '00000000-0000-0000-0000-000000000003'
    )$$,
  'actions can be created while a meeting is in progress'
);
select lives_ok(
  $$update public.meetings
    set status = 'completed'
    where id = '90000000-0000-4000-8000-000000000001'$$,
  'committee Chair can complete an in-progress meeting'
);
select throws_ok(
  $$update public.meetings
    set title = 'Changed after completion'
    where id = '90000000-0000-4000-8000-000000000001'$$,
  '23514',
  'Completed meetings are locked and cannot be changed.',
  'completed meeting details are immutable'
);
select throws_ok(
  $$update public.meeting_attendance
    set present = false
    where meeting_id = '90000000-0000-4000-8000-000000000001'$$,
  '23514',
  'Attendance can only be changed while a meeting is in progress.',
  'completed meeting attendance is immutable'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select lives_ok(
  $$update public.meetings
    set status = 'in_progress'
    where id = '90000000-0000-4000-8000-000000000001'$$,
  'committee Staff can unlock a completed meeting'
);
select lives_ok(
  $$update public.meeting_attendance
    set present = false,
        marked_at = now(),
        marked_by = '00000000-0000-0000-0000-000000000004'
    where meeting_id = '90000000-0000-4000-8000-000000000001'$$,
  'attendance can be corrected after an authorized unlock'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$update public.meetings
    set archived_at = now()
    where id = '90000000-0000-4000-8000-000000000001'$$,
  'an administrator can archive an unlocked meeting'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
delete from public.meetings
where id = '90000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.meetings where id = '90000000-0000-4000-8000-000000000001'),
  1::bigint,
  'committee Staff cannot permanently delete a meeting'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$delete from public.meetings
    where id = '90000000-0000-4000-8000-000000000001'$$,
  'an administrator can permanently delete a meeting and its child records'
);

select is(
  private.rich_text_plain('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Formatted agenda"}]}]}'),
  'Formatted agenda',
  'rich text remains human-readable for search'
);

select * from finish();
rollback;
