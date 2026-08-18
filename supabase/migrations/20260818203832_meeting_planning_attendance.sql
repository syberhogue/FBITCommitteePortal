alter table public.meetings alter column status drop default;
alter type public.meeting_status rename to meeting_status_legacy;
create type public.meeting_status as enum (
  'planned', 'scheduled', 'in_progress', 'completed', 'cancelled'
);
alter table public.meetings
  alter column status type public.meeting_status
  using status::text::public.meeting_status;
alter table public.meetings alter column status set default 'planned';
drop type public.meeting_status_legacy;

alter table public.meetings
  add column goals text not null default '',
  add column finalized_at timestamptz,
  add column finalized_by uuid references public.profiles (id) on delete set null,
  add column started_at timestamptz,
  add column archived_at timestamptz;

create index meetings_finalized_by_idx on public.meetings (finalized_by);
create index meetings_status_starts_idx on public.meetings (status, starts_at desc)
  where archived_at is null;
create index meetings_archived_at_idx on public.meetings (archived_at)
  where archived_at is not null;

drop index public.meetings_search_idx;
alter table public.meetings drop column search_vector;
alter table public.meetings add column search_vector tsvector generated always as (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    private.rich_text_plain(agenda) || ' ' ||
    private.rich_text_plain(goals) || ' ' ||
    private.rich_text_plain(minutes)
  )
) stored;
create index meetings_search_idx on public.meetings using gin (search_vector);

create table public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  present boolean not null default false,
  marked_at timestamptz,
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, profile_id)
);

create index meeting_attendance_meeting_idx on public.meeting_attendance (meeting_id);
create index meeting_attendance_profile_idx on public.meeting_attendance (profile_id);
create index meeting_attendance_marked_by_idx on public.meeting_attendance (marked_by);
create trigger meeting_attendance_set_updated_at
before update on public.meeting_attendance
for each row execute function private.set_updated_at();

create or replace function private.can_plan_meeting(requested_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and private.has_committee_access(
      requested_committee_id,
      array['chair', 'staff']::public.committee_access_level[]
    );
$$;

create or replace function private.can_finalize_meeting(requested_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and private.has_committee_access(
      requested_committee_id,
      array['chair']::public.committee_access_level[]
    );
$$;

create or replace function private.can_unlock_meeting(requested_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or (
      private.is_active_user()
      and private.has_committee_access(
        requested_committee_id,
        array['staff']::public.committee_access_level[]
      )
    );
$$;

create or replace function private.can_archive_meeting(requested_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin_or_dean()
    or private.can_plan_meeting(requested_committee_id);
$$;

revoke all on function private.can_plan_meeting(uuid) from public, anon;
revoke all on function private.can_finalize_meeting(uuid) from public, anon;
revoke all on function private.can_unlock_meeting(uuid) from public, anon;
revoke all on function private.can_archive_meeting(uuid) from public, anon;
grant execute on function private.can_plan_meeting(uuid) to authenticated;
grant execute on function private.can_finalize_meeting(uuid) to authenticated;
grant execute on function private.can_unlock_meeting(uuid) to authenticated;
grant execute on function private.can_archive_meeting(uuid) to authenticated;

drop policy meetings_select on public.meetings;
drop policy meetings_insert on public.meetings;
drop policy meetings_update on public.meetings;
drop policy meetings_delete on public.meetings;

create policy meetings_select on public.meetings for select to authenticated
using (
  private.can_view_committee(committee_id)
  and (
    status <> 'planned'
    or private.can_plan_meeting(committee_id)
    or private.is_admin_or_dean()
  )
);
create policy meetings_insert on public.meetings for insert to authenticated
with check (
  private.can_plan_meeting(committee_id)
  and created_by = (select auth.uid())
  and status = 'planned'
);
create policy meetings_update on public.meetings for update to authenticated
using (
  private.can_plan_meeting(committee_id)
  or private.can_unlock_meeting(committee_id)
  or private.can_archive_meeting(committee_id)
)
with check (
  private.can_plan_meeting(committee_id)
  or private.can_unlock_meeting(committee_id)
  or private.can_archive_meeting(committee_id)
);
create policy meetings_delete on public.meetings for delete to authenticated
using (
  status <> 'completed'
  and (private.can_plan_meeting(committee_id) or private.is_admin_or_dean())
);

create or replace function private.lock_completed_meeting()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  only_archiving boolean;
begin
  if tg_op = 'DELETE' then
    if old.status = 'completed' then
      raise exception 'Completed meetings must be archived instead of deleted.'
        using errcode = 'check_violation';
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

revoke all on function private.lock_completed_meeting_attendance() from public, anon, authenticated;
create trigger meeting_attendance_lock_by_status
before insert or update or delete on public.meeting_attendance
for each row execute function private.lock_completed_meeting_attendance();

alter table public.meeting_attendance enable row level security;
create policy attendance_select on public.meeting_attendance for select to authenticated
using (private.can_view_committee(private.committee_for_meeting(meeting_id)));
create policy attendance_insert on public.meeting_attendance for insert to authenticated
with check (private.can_plan_meeting(private.committee_for_meeting(meeting_id)));
create policy attendance_update on public.meeting_attendance for update to authenticated
using (private.can_plan_meeting(private.committee_for_meeting(meeting_id)))
with check (private.can_plan_meeting(private.committee_for_meeting(meeting_id)));
create policy attendance_delete on public.meeting_attendance for delete to authenticated
using (private.can_plan_meeting(private.committee_for_meeting(meeting_id)));

grant select, insert, update, delete on public.meeting_attendance to authenticated;

create or replace function private.audit_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  resolved_meeting_id uuid := (row_data ->> 'meeting_id')::uuid;
begin
  insert into public.activity_log (
    actor_id, event_type, entity_type, entity_id, committee_id, details
  ) values (
    (select auth.uid()),
    lower('meeting_attendance.' || tg_op),
    'meeting_attendance',
    (row_data ->> 'id')::uuid,
    private.committee_for_meeting(resolved_meeting_id),
    jsonb_build_object(
      'profile_id', row_data ->> 'profile_id',
      'present', row_data ->> 'present'
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_attendance_change() from public, anon, authenticated;
create trigger audit_meeting_attendance
after insert or update or delete on public.meeting_attendance
for each row execute function private.audit_attendance_change();
