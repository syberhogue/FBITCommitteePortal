create or replace function private.enforce_meeting_edit_phase()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    return new;
  end if;
  if new.status is distinct from old.status then
    return new;
  end if;
  if old.status not in ('planned', 'in_progress') then
    raise exception 'Meeting details can only be edited while planning or while the meeting is in progress.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_meeting_edit_phase() from public, anon, authenticated;
create trigger meetings_enforce_edit_phase
before update on public.meetings
for each row execute function private.enforce_meeting_edit_phase();

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

  if resolved_status <> 'in_progress' then
    raise exception 'Action items can only be changed while a meeting is in progress.'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
