create table public.agenda_template_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 500),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sort_order)
);

create table public.agenda_template_item_assignees (
  agenda_item_id uuid not null references public.agenda_template_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agenda_item_id, profile_id)
);

create table public.meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 500),
  sort_order integer not null check (sort_order >= 0),
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, sort_order),
  check (
    (completed_at is null and completed_by is null)
    or (completed_at is not null and completed_by is not null)
  )
);

create table public.meeting_agenda_item_assignees (
  agenda_item_id uuid not null references public.meeting_agenda_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agenda_item_id, profile_id)
);

create index agenda_template_item_assignees_profile_idx
  on public.agenda_template_item_assignees (profile_id);
create index meeting_agenda_items_meeting_idx
  on public.meeting_agenda_items (meeting_id, sort_order);
create index meeting_agenda_items_completed_by_idx
  on public.meeting_agenda_items (completed_by)
  where completed_by is not null;
create index meeting_agenda_item_assignees_profile_idx
  on public.meeting_agenda_item_assignees (profile_id);

create trigger agenda_template_items_set_updated_at
before update on public.agenda_template_items
for each row execute function private.set_updated_at();
create trigger meeting_agenda_items_set_updated_at
before update on public.meeting_agenda_items
for each row execute function private.set_updated_at();

insert into public.agenda_template_items (title, sort_order) values
  ('Call to Order & Attendance Roll Call', 10),
  ('Review & Approval of Previous Minutes', 20),
  ('Standing Reports', 30),
  ('Unfinished Business', 40),
  ('New Business', 50),
  ('Action Items & Next Steps', 60),
  ('Adjournment', 70);

insert into public.meeting_agenda_items (meeting_id, title, sort_order)
select
  meeting.id,
  left(nullif(trim(private.rich_text_plain(meeting.agenda)), ''), 500),
  10
from public.meetings meeting
where nullif(trim(private.rich_text_plain(meeting.agenda)), '') is not null;

create or replace function private.enforce_meeting_agenda_edit_phase()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_meeting_id uuid := case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end;
  resolved_status public.meeting_status;
  resolved_archived_at timestamptz;
begin
  select meeting.status, meeting.archived_at
    into resolved_status, resolved_archived_at
  from public.meetings meeting
  where meeting.id = resolved_meeting_id;

  if resolved_status not in ('planned', 'in_progress') or resolved_archived_at is not null then
    raise exception 'Agenda items can only be changed while planning or while the meeting is in progress.'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.enforce_meeting_agenda_assignee_edit_phase()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_agenda_item_id uuid := case when tg_op = 'DELETE' then old.agenda_item_id else new.agenda_item_id end;
  resolved_status public.meeting_status;
  resolved_archived_at timestamptz;
begin
  select meeting.status, meeting.archived_at
    into resolved_status, resolved_archived_at
  from public.meeting_agenda_items agenda_item
  join public.meetings meeting on meeting.id = agenda_item.meeting_id
  where agenda_item.id = resolved_agenda_item_id;

  if resolved_status not in ('planned', 'in_progress') or resolved_archived_at is not null then
    raise exception 'Agenda assignments can only be changed while planning or while the meeting is in progress.'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.enforce_meeting_agenda_edit_phase()
  from public, anon, authenticated;
revoke all on function private.enforce_meeting_agenda_assignee_edit_phase()
  from public, anon, authenticated;

create trigger meeting_agenda_items_edit_phase
before insert or update or delete on public.meeting_agenda_items
for each row execute function private.enforce_meeting_agenda_edit_phase();
create trigger meeting_agenda_item_assignees_edit_phase
before insert or update or delete on public.meeting_agenda_item_assignees
for each row execute function private.enforce_meeting_agenda_assignee_edit_phase();

alter table public.agenda_template_items enable row level security;
alter table public.agenda_template_item_assignees enable row level security;
alter table public.meeting_agenda_items enable row level security;
alter table public.meeting_agenda_item_assignees enable row level security;

create policy agenda_template_items_select on public.agenda_template_items
for select to authenticated
using (private.is_active_user());
create policy agenda_template_items_insert on public.agenda_template_items
for insert to authenticated
with check (private.is_admin());
create policy agenda_template_items_update on public.agenda_template_items
for update to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy agenda_template_items_delete on public.agenda_template_items
for delete to authenticated
using (private.is_admin());

create policy agenda_template_assignees_select on public.agenda_template_item_assignees
for select to authenticated
using (private.is_active_user());
create policy agenda_template_assignees_insert on public.agenda_template_item_assignees
for insert to authenticated
with check (private.is_admin());
create policy agenda_template_assignees_delete on public.agenda_template_item_assignees
for delete to authenticated
using (private.is_admin());

create policy meeting_agenda_items_select on public.meeting_agenda_items
for select to authenticated
using (
  exists (
    select 1 from public.meetings meeting where meeting.id = meeting_id
  )
);
create policy meeting_agenda_items_insert on public.meeting_agenda_items
for insert to authenticated
with check (
  private.can_plan_meeting(private.committee_for_meeting(meeting_id))
  and exists (
    select 1 from public.meetings meeting
    where meeting.id = meeting_id
      and meeting.status in ('planned', 'in_progress')
      and meeting.archived_at is null
  )
);
create policy meeting_agenda_items_update on public.meeting_agenda_items
for update to authenticated
using (private.can_plan_meeting(private.committee_for_meeting(meeting_id)))
with check (
  private.can_plan_meeting(private.committee_for_meeting(meeting_id))
  and exists (
    select 1 from public.meetings meeting
    where meeting.id = meeting_id
      and meeting.status in ('planned', 'in_progress')
      and meeting.archived_at is null
  )
);
create policy meeting_agenda_items_delete on public.meeting_agenda_items
for delete to authenticated
using (private.can_plan_meeting(private.committee_for_meeting(meeting_id)));

create policy meeting_agenda_assignees_select on public.meeting_agenda_item_assignees
for select to authenticated
using (
  exists (
    select 1 from public.meeting_agenda_items agenda_item
    where agenda_item.id = agenda_item_id
  )
);
create policy meeting_agenda_assignees_insert on public.meeting_agenda_item_assignees
for insert to authenticated
with check (
  exists (
    select 1 from public.meeting_agenda_items agenda_item
    where agenda_item.id = agenda_item_id
      and private.can_plan_meeting(private.committee_for_meeting(agenda_item.meeting_id))
  )
);
create policy meeting_agenda_assignees_delete on public.meeting_agenda_item_assignees
for delete to authenticated
using (
  exists (
    select 1 from public.meeting_agenda_items agenda_item
    where agenda_item.id = agenda_item_id
      and private.can_plan_meeting(private.committee_for_meeting(agenda_item.meeting_id))
  )
);

grant select, insert, update, delete on public.agenda_template_items to authenticated;
grant select, insert, delete on public.agenda_template_item_assignees to authenticated;
grant select, insert, update, delete on public.meeting_agenda_items to authenticated;
grant select, insert, delete on public.meeting_agenda_item_assignees to authenticated;

create or replace function public.set_agenda_item_completion(
  agenda_item_id uuid,
  is_completed boolean,
  minutes_value text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_meeting_id uuid;
  resolved_committee_id uuid;
  resolved_status public.meeting_status;
begin
  select agenda_item.meeting_id, meeting.committee_id, meeting.status
    into resolved_meeting_id, resolved_committee_id, resolved_status
  from public.meeting_agenda_items agenda_item
  join public.meetings meeting on meeting.id = agenda_item.meeting_id
  where agenda_item.id = agenda_item_id
    and meeting.archived_at is null;

  if resolved_meeting_id is null then
    raise exception 'Agenda item not found.' using errcode = 'no_data_found';
  end if;
  if resolved_status <> 'in_progress' or not private.can_plan_meeting(resolved_committee_id) then
    raise exception 'Only committee Staff or Chairs can check agenda items during an active meeting.'
      using errcode = 'insufficient_privilege';
  end if;
  if is_completed and minutes_value is null then
    raise exception 'Minutes are required when completing an agenda item.'
      using errcode = 'not_null_violation';
  end if;

  update public.meeting_agenda_items
  set completed_at = case when is_completed then now() else null end,
      completed_by = case when is_completed then (select auth.uid()) else null end
  where id = agenda_item_id;

  if is_completed then
    update public.meetings set minutes = minutes_value where id = resolved_meeting_id;
  end if;
end;
$$;

revoke all on function public.set_agenda_item_completion(uuid, boolean, text)
  from public, anon;
grant execute on function public.set_agenda_item_completion(uuid, boolean, text)
  to authenticated;

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  resolved_entity_id uuid;
  resolved_committee_id uuid;
  resolved_label text;
begin
  resolved_entity_id := case
    when tg_table_name = 'allowed_email_domains' then null
    else nullif(row_data ->> 'id', '')::uuid
  end;
  resolved_committee_id := case
    when tg_table_name = 'committees' then resolved_entity_id
    when row_data ? 'committee_id' then nullif(row_data ->> 'committee_id', '')::uuid
    when tg_table_name in ('action_items', 'meeting_agenda_items') then
      private.committee_for_meeting((row_data ->> 'meeting_id')::uuid)
    when tg_table_name = 'meeting_agenda_item_assignees' then (
      select private.committee_for_meeting(agenda_item.meeting_id)
      from public.meeting_agenda_items agenda_item
      where agenda_item.id = (row_data ->> 'agenda_item_id')::uuid
    )
    when tg_table_name = 'resource_links' then private.committee_for_group((row_data ->> 'group_id')::uuid)
    else null
  end;
  resolved_label := coalesce(
    row_data ->> 'name', row_data ->> 'title', row_data ->> 'task',
    row_data ->> 'key', row_data ->> 'email', ''
  );
  insert into public.activity_log (
    actor_id, event_type, entity_type, entity_id, committee_id, details
  ) values (
    (select auth.uid()), lower(tg_table_name || '.' || tg_op), tg_table_name,
    resolved_entity_id, resolved_committee_id,
    jsonb_strip_nulls(jsonb_build_object(
      'label', resolved_label,
      'status', row_data ->> 'status',
      'archived', case when row_data ? 'archived_at' then row_data ->> 'archived_at' is not null else null end,
      'completed', case when row_data ? 'completed' then (row_data ->> 'completed')::boolean else null end
    ))
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger audit_agenda_template_items
after insert or update or delete on public.agenda_template_items
for each row execute function private.audit_row_change();
create trigger audit_agenda_template_item_assignees
after insert or delete on public.agenda_template_item_assignees
for each row execute function private.audit_row_change();
create trigger audit_meeting_agenda_items
after insert or update or delete on public.meeting_agenda_items
for each row execute function private.audit_row_change();
create trigger audit_meeting_agenda_item_assignees
after insert or delete on public.meeting_agenda_item_assignees
for each row execute function private.audit_row_change();
