alter table public.committees
  add column color text not null default '#003C71',
  add constraint committees_color_palette_check check (
    color in ('#003C71', '#0077CA', '#E75D2A', '#00843D', '#6F2C91', '#007F86')
  );

drop policy committees_update on public.committees;
create policy committees_update on public.committees for update to authenticated
using (
  private.is_admin_or_dean()
  or private.has_committee_access(
    id,
    array['chair', 'staff']::public.committee_access_level[]
  )
)
with check (
  private.is_admin_or_dean()
  or private.has_committee_access(
    id,
    array['chair', 'staff']::public.committee_access_level[]
  )
);

create or replace function private.enforce_committee_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.status is distinct from old.status or new.created_by is distinct from old.created_by)
    and not private.is_admin_or_dean() then
    raise exception 'Only an administrator or dean may change committee lifecycle or ownership.'
      using errcode = 'insufficient_privilege';
  end if;

  if not private.is_admin_or_dean()
    and not private.has_committee_access(
      old.id,
      array['chair']::public.committee_access_level[]
    )
    and private.has_committee_access(
      old.id,
      array['staff']::public.committee_access_level[]
    )
    and (
      to_jsonb(new) - 'color' - 'updated_at' - 'search_vector'
      is distinct from
      to_jsonb(old) - 'color' - 'updated_at' - 'search_vector'
    ) then
    raise exception 'Committee Staff may only change the committee colour.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_committee_update_scope() from public, anon, authenticated;

create index meetings_active_committee_idx
  on public.meetings (committee_id)
  where status = 'in_progress' and archived_at is null;

create or replace function private.enforce_single_in_progress_meeting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'in_progress' or new.archived_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'in_progress'
    and old.archived_at is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.committee_id::text, 0)
  );

  if exists (
    select 1
    from public.meetings meeting
    where meeting.committee_id = new.committee_id
      and meeting.status = 'in_progress'
      and meeting.archived_at is null
      and meeting.id <> new.id
  ) then
    raise exception 'Complete the current in-progress meeting before starting another.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_single_in_progress_meeting()
  from public, anon, authenticated;

create trigger meetings_single_in_progress
before insert or update on public.meetings
for each row execute function private.enforce_single_in_progress_meeting();

drop policy activity_select on public.activity_log;
create policy activity_select on public.activity_log for select to authenticated
using (
  private.is_admin()
  or (
    committee_id is not null
    and private.has_committee_access(
      committee_id,
      array['chair', 'staff', 'member']::public.committee_access_level[]
    )
  )
);

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
    when tg_table_name = 'action_items' then private.committee_for_meeting((row_data ->> 'meeting_id')::uuid)
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
