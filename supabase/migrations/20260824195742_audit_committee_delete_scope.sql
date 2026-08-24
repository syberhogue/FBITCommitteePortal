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
  audit_committee_id uuid;
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
  audit_committee_id := resolved_committee_id;

  if resolved_committee_id is not null
    and not exists (
      select 1
      from public.committees committee
      where committee.id = resolved_committee_id
    )
  then
    resolved_committee_id := null;
  end if;

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
      'committee_id', audit_committee_id,
      'status', row_data ->> 'status',
      'archived', case when row_data ? 'archived_at' then row_data ->> 'archived_at' is not null else null end,
      'completed', case when row_data ? 'completed' then (row_data ->> 'completed')::boolean else null end
    ))
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
