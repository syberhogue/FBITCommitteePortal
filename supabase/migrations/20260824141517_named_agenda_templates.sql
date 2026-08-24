create table public.agenda_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  committee_id uuid references public.committees (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    committee_id is not null
    or created_by is not null
  )
);

create unique index agenda_templates_global_name_idx
  on public.agenda_templates (lower(name))
  where committee_id is null;
create unique index agenda_templates_committee_name_idx
  on public.agenda_templates (committee_id, lower(name))
  where committee_id is not null;
create index agenda_templates_committee_idx
  on public.agenda_templates (committee_id)
  where committee_id is not null;
create trigger agenda_templates_set_updated_at
before update on public.agenda_templates
for each row execute function private.set_updated_at();

insert into public.agenda_templates (id, name, created_by)
values (
  '40000000-0000-4000-8000-000000000001',
  'Default agenda',
  '00000000-0000-0000-0000-000000000001'
);

alter table public.agenda_template_items
  drop constraint agenda_template_items_sort_order_key,
  add column template_id uuid references public.agenda_templates (id) on delete cascade;

update public.agenda_template_items
set template_id = '40000000-0000-4000-8000-000000000001'
where template_id is null;

alter table public.agenda_template_items
  alter column template_id set not null,
  add constraint agenda_template_items_template_sort_key unique (template_id, sort_order);
create index agenda_template_items_template_idx
  on public.agenda_template_items (template_id, sort_order);

drop policy agenda_template_items_select on public.agenda_template_items;
drop policy agenda_template_items_insert on public.agenda_template_items;
drop policy agenda_template_items_update on public.agenda_template_items;
drop policy agenda_template_items_delete on public.agenda_template_items;
drop policy agenda_template_assignees_select on public.agenda_template_item_assignees;
drop policy agenda_template_assignees_insert on public.agenda_template_item_assignees;
drop policy agenda_template_assignees_delete on public.agenda_template_item_assignees;

alter table public.agenda_templates enable row level security;

create policy agenda_templates_select on public.agenda_templates
for select to authenticated
using (
  private.is_active_user()
  and (
    committee_id is null
    or private.can_view_committee(committee_id)
  )
);
create policy agenda_templates_insert on public.agenda_templates
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (committee_id is null and private.is_admin())
    or (committee_id is not null and private.can_edit_content(committee_id))
  )
);
create policy agenda_templates_update on public.agenda_templates
for update to authenticated
using (
  (committee_id is null and private.is_admin())
  or (committee_id is not null and private.can_edit_content(committee_id))
)
with check (
  (committee_id is null and private.is_admin())
  or (committee_id is not null and private.can_edit_content(committee_id))
);
create policy agenda_templates_delete on public.agenda_templates
for delete to authenticated
using (
  (committee_id is null and private.is_admin())
  or (committee_id is not null and private.can_edit_content(committee_id))
);

create policy agenda_template_items_select on public.agenda_template_items
for select to authenticated
using (
  exists (
    select 1
    from public.agenda_templates template
    where template.id = template_id
      and private.is_active_user()
      and (
        template.committee_id is null
        or private.can_view_committee(template.committee_id)
      )
  )
);
create policy agenda_template_items_insert on public.agenda_template_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.agenda_templates template
    where template.id = template_id
      and (
        (template.committee_id is null and private.is_admin())
        or (
          template.committee_id is not null
          and private.can_edit_content(template.committee_id)
        )
      )
  )
);
create policy agenda_template_items_update on public.agenda_template_items
for update to authenticated
using (
  exists (
    select 1
    from public.agenda_templates template
    where template.id = template_id
      and (
        (template.committee_id is null and private.is_admin())
        or (
          template.committee_id is not null
          and private.can_edit_content(template.committee_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.agenda_templates template
    where template.id = template_id
      and (
        (template.committee_id is null and private.is_admin())
        or (
          template.committee_id is not null
          and private.can_edit_content(template.committee_id)
        )
      )
  )
);
create policy agenda_template_items_delete on public.agenda_template_items
for delete to authenticated
using (
  exists (
    select 1
    from public.agenda_templates template
    where template.id = template_id
      and (
        (template.committee_id is null and private.is_admin())
        or (
          template.committee_id is not null
          and private.can_edit_content(template.committee_id)
        )
      )
  )
);

create policy agenda_template_assignees_select on public.agenda_template_item_assignees
for select to authenticated
using (
  exists (
    select 1
    from public.agenda_template_items item
    join public.agenda_templates template on template.id = item.template_id
    where item.id = agenda_item_id
      and private.is_active_user()
      and (
        template.committee_id is null
        or private.can_view_committee(template.committee_id)
      )
  )
);
create policy agenda_template_assignees_insert on public.agenda_template_item_assignees
for insert to authenticated
with check (
  exists (
    select 1
    from public.agenda_template_items item
    join public.agenda_templates template on template.id = item.template_id
    where item.id = agenda_item_id
      and (
        (template.committee_id is null and private.is_admin())
        or (
          template.committee_id is not null
          and private.can_edit_content(template.committee_id)
        )
      )
  )
);
create policy agenda_template_assignees_delete on public.agenda_template_item_assignees
for delete to authenticated
using (
  exists (
    select 1
    from public.agenda_template_items item
    join public.agenda_templates template on template.id = item.template_id
    where item.id = agenda_item_id
      and (
        (template.committee_id is null and private.is_admin())
        or (
          template.committee_id is not null
          and private.can_edit_content(template.committee_id)
        )
      )
  )
);

grant select, insert, update, delete on public.agenda_templates to authenticated;
