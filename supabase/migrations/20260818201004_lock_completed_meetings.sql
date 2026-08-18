create or replace function private.lock_completed_meeting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' then
    raise exception 'Completed meetings are locked and cannot be changed.'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.lock_completed_meeting_actions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_meeting_id uuid := case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end;
  resolved_status public.meeting_status;
begin
  select meeting.status into resolved_status
  from public.meetings meeting
  where meeting.id = resolved_meeting_id;

  if resolved_status = 'completed' then
    raise exception 'Action items for completed meetings are locked and cannot be changed.'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.lock_completed_meeting() from public, anon, authenticated;
revoke all on function private.lock_completed_meeting_actions() from public, anon, authenticated;

create trigger meetings_lock_completed
before update or delete on public.meetings
for each row execute function private.lock_completed_meeting();

create trigger action_items_lock_completed_meeting
before insert or update or delete on public.action_items
for each row execute function private.lock_completed_meeting_actions();
