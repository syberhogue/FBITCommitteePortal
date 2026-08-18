drop policy meetings_delete on public.meetings;
create policy meetings_delete on public.meetings for delete to authenticated
using (private.is_admin());

create or replace function private.lock_completed_meeting()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  only_archiving boolean;
begin
  if tg_op = 'DELETE' then
    if not private.is_admin() then
      raise exception 'Only administrators can permanently delete meetings.'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  only_archiving := new.archived_at is distinct from old.archived_at
    and new.status = old.status
    and new.title = old.title
    and new.starts_at = old.starts_at
    and new.agenda = old.agenda
    and new.goals = old.goals
    and new.minutes = old.minutes
    and new.started_at is not distinct from old.started_at
    and new.finalized_at is not distinct from old.finalized_at
    and new.finalized_by is not distinct from old.finalized_by;

  if new.archived_at is distinct from old.archived_at then
    if not only_archiving or not private.can_archive_meeting(old.committee_id) then
      raise exception 'You are not allowed to archive this meeting.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if old.status = 'completed' then
    if new.status = 'in_progress'
      and private.can_unlock_meeting(old.committee_id)
      and new.title = old.title
      and new.starts_at = old.starts_at
      and new.agenda = old.agenda
      and new.goals = old.goals
      and new.minutes = old.minutes
    then
      return new;
    end if;
    raise exception 'Completed meetings are locked and cannot be changed.'
      using errcode = 'check_violation';
  end if;

  if old.status = 'planned' and new.status = 'scheduled' then
    if not private.can_finalize_meeting(old.committee_id)
      or new.finalized_by is distinct from (select auth.uid())
      or new.finalized_at is null
    then
      raise exception 'Only the committee Chair can finalize a meeting plan.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if old.status = 'scheduled' and new.status = 'in_progress' then
    if not private.can_plan_meeting(old.committee_id) or new.started_at is null then
      raise exception 'Only committee Staff or Chairs can start a meeting.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if old.status = 'in_progress' and new.status = 'completed' then
    if not private.can_plan_meeting(old.committee_id) then
      raise exception 'Only committee Staff or Chairs can complete a meeting.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Invalid meeting status transition from % to %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if not private.can_plan_meeting(old.committee_id) then
    raise exception 'Only committee Staff or Chairs can edit a meeting.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create or replace function private.lock_completed_meeting_attendance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_meeting_id uuid := case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end;
  resolved_status public.meeting_status;
  resolved_committee_id uuid;
begin
  if tg_op = 'DELETE' and private.is_admin() then
    return old;
  end if;

  select meeting.status, meeting.committee_id
    into resolved_status, resolved_committee_id
  from public.meetings meeting
  where meeting.id = resolved_meeting_id;

  if resolved_status <> 'in_progress' then
    raise exception 'Attendance can only be changed while a meeting is in progress.'
      using errcode = 'check_violation';
  end if;
  if not private.can_plan_meeting(resolved_committee_id) then
    raise exception 'Only committee Staff or Chairs can record attendance.'
      using errcode = 'insufficient_privilege';
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
  if tg_op = 'DELETE' and private.is_admin() then
    return old;
  end if;

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

revoke all on function private.lock_completed_meeting() from public, anon, authenticated;
revoke all on function private.lock_completed_meeting_attendance() from public, anon, authenticated;
revoke all on function private.lock_completed_meeting_actions() from public, anon, authenticated;
