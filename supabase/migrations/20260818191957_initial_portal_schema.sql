create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;

create type public.account_status as enum ('pending', 'active', 'suspended');
create type public.person_category as enum ('faculty', 'staff', 'admin');
create type public.global_role as enum ('admin', 'dean', 'staff', 'faculty');
create type public.committee_status as enum ('active', 'archived');
create type public.committee_access_level as enum ('chair', 'staff', 'member');
create type public.meeting_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type public.action_priority as enum ('low', 'medium', 'high');
create type public.backup_status as enum ('running', 'succeeded', 'failed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null unique,
  full_name text not null check (char_length(trim(full_name)) between 1 and 160),
  person_category public.person_category not null default 'faculty',
  global_role public.global_role not null default 'faculty',
  status public.account_status not null default 'pending',
  department text,
  title text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('english',
      coalesce(full_name, '') || ' ' || coalesce(email::text, '') || ' ' ||
      coalesce(department, '') || ' ' || coalesce(title, '')
    )
  ) stored
);

create table public.allowed_email_domains (
  id bigint generated always as identity primary key,
  domain extensions.citext not null unique check (
    domain::text = lower(domain::text)
    and domain::text !~ '[@/ ]'
    and position('.' in domain::text) > 1
  ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committee_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  access_level public.committee_access_level not null,
  is_system boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  mandate text not null default '',
  status public.committee_status not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(mandate, ''))
  ) stored
);

create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.committee_roles (id),
  joined_at timestamptz not null default now(),
  unique (committee_id, profile_id)
);

create table public.role_expectations (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  role_id uuid not null references public.committee_roles (id) on delete cascade,
  expectation_text text not null default '',
  updated_at timestamptz not null default now(),
  unique (committee_id, role_id)
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  starts_at timestamptz not null,
  status public.meeting_status not null default 'scheduled',
  agenda text not null default '',
  minutes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(agenda, '') || ' ' || coalesce(minutes, ''))
  ) stored
);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  task text not null check (char_length(trim(task)) between 1 and 1000),
  assignee_id uuid references public.profiles (id) on delete set null,
  priority public.action_priority not null default 'medium',
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (to_tsvector('english', coalesce(task, ''))) stored,
  check ((completed and completed_at is not null) or (not completed and completed_at is null))
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 500),
  target_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((completed and completed_at is not null) or (not completed and completed_at is null))
);

create table public.resource_groups (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resource_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.resource_groups (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  url text not null check (url ~* '^https?://'),
  description text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,80}$'),
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  committee_id uuid references public.committees (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  status public.backup_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  object_key text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  retention_class text check (retention_class in ('daily', 'monthly')),
  error_message text,
  created_at timestamptz not null default now()
);

create index profiles_status_idx on public.profiles (status);
create index profiles_search_idx on public.profiles using gin (search_vector);
create index committees_created_by_idx on public.committees (created_by);
create index committees_status_idx on public.committees (status);
create index committees_search_idx on public.committees using gin (search_vector);
create index committee_members_profile_id_idx on public.committee_members (profile_id);
create index committee_members_role_id_idx on public.committee_members (role_id);
create index committee_members_committee_role_idx on public.committee_members (committee_id, role_id);
create index role_expectations_role_id_idx on public.role_expectations (role_id);
create index meetings_committee_starts_idx on public.meetings (committee_id, starts_at desc);
create index meetings_created_by_idx on public.meetings (created_by);
create index meetings_search_idx on public.meetings using gin (search_vector);
create index action_items_meeting_id_idx on public.action_items (meeting_id);
create index action_items_assignee_id_idx on public.action_items (assignee_id);
create index action_items_created_by_idx on public.action_items (created_by);
create index action_items_pending_idx on public.action_items (meeting_id, priority) where not completed;
create index action_items_search_idx on public.action_items using gin (search_vector);
create index goals_committee_id_idx on public.goals (committee_id);
create index goals_created_by_idx on public.goals (created_by);
create index goals_active_idx on public.goals (committee_id, target_date) where not completed;
create index resource_groups_committee_order_idx on public.resource_groups (committee_id, sort_order);
create index resource_links_group_order_idx on public.resource_links (group_id, sort_order);
create index system_settings_updated_by_idx on public.system_settings (updated_by);
create index activity_log_actor_id_idx on public.activity_log (actor_id);
create index activity_log_committee_created_idx on public.activity_log (committee_id, created_at desc);
create index activity_log_created_at_idx on public.activity_log (created_at desc);
create index backup_runs_started_at_idx on public.backup_runs (started_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger allowed_email_domains_set_updated_at before update on public.allowed_email_domains
for each row execute function private.set_updated_at();
create trigger committee_roles_set_updated_at before update on public.committee_roles
for each row execute function private.set_updated_at();
create trigger committees_set_updated_at before update on public.committees
for each row execute function private.set_updated_at();
create trigger role_expectations_set_updated_at before update on public.role_expectations
for each row execute function private.set_updated_at();
create trigger meetings_set_updated_at before update on public.meetings
for each row execute function private.set_updated_at();
create trigger action_items_set_updated_at before update on public.action_items
for each row execute function private.set_updated_at();
create trigger goals_set_updated_at before update on public.goals
for each row execute function private.set_updated_at();
create trigger resource_groups_set_updated_at before update on public.resource_groups
for each row execute function private.set_updated_at();
create trigger resource_links_set_updated_at before update on public.resource_links
for each row execute function private.set_updated_at();

create or replace function private.set_completion_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed and (old.completed is distinct from true or new.completed_at is null) then
    new.completed_at = now();
  elsif not new.completed then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger action_items_set_completion before insert or update on public.action_items
for each row execute function private.set_completion_timestamp();
create trigger goals_set_completion before insert or update on public.goals
for each row execute function private.set_completion_timestamp();

create or replace function private.enforce_committee_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.status is distinct from old.status or new.created_by is distinct from old.created_by)
    and not private.is_admin_or_dean() then
    raise exception 'Only an administrator or dean may change committee lifecycle or ownership.';
  end if;
  return new;
end;
$$;

create trigger committees_enforce_update_scope before update on public.committees
for each row execute function private.enforce_committee_update_scope();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_domain text;
begin
  requested_domain := lower(split_part(event -> 'user' ->> 'email', '@', 2));
  if requested_domain <> '' and exists (
    select 1 from public.allowed_email_domains d
    where d.enabled and d.domain::text = requested_domain
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Please use an approved university email address.'
    )
  );
end;
$$;

revoke all on function private.hook_restrict_signup_by_email_domain(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.hook_restrict_signup_by_email_domain(jsonb) to supabase_auth_admin;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active' and p.global_role = 'admin'
  );
$$;

create or replace function private.is_admin_or_dean()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active' and p.global_role in ('admin', 'dean')
  );
$$;

create or replace function private.has_committee_access(
  requested_committee_id uuid,
  requested_levels public.committee_access_level[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user() and exists (
    select 1
    from public.committee_members cm
    join public.committee_roles cr on cr.id = cm.role_id
    where cm.committee_id = requested_committee_id
      and cm.profile_id = (select auth.uid())
      and cr.access_level = any(requested_levels)
  );
$$;

create or replace function private.can_view_committee(requested_committee_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin_or_dean()
    or private.has_committee_access(requested_committee_id, array['chair', 'staff', 'member']::public.committee_access_level[]);
$$;

create or replace function private.can_manage_roster(requested_committee_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin_or_dean()
    or private.has_committee_access(requested_committee_id, array['chair']::public.committee_access_level[]);
$$;

create or replace function private.can_edit_content(requested_committee_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin_or_dean()
    or private.has_committee_access(requested_committee_id, array['chair', 'staff']::public.committee_access_level[]);
$$;

create or replace function private.committee_for_meeting(requested_meeting_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.committee_id from public.meetings m where m.id = requested_meeting_id;
$$;

create or replace function private.committee_for_group(requested_group_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select rg.committee_id from public.resource_groups rg where rg.id = requested_group_id;
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_admin_or_dean() to authenticated;
grant execute on function private.has_committee_access(uuid, public.committee_access_level[]) to authenticated;
grant execute on function private.can_view_committee(uuid) to authenticated;
grant execute on function private.can_manage_roster(uuid) to authenticated;
grant execute on function private.can_edit_content(uuid) to authenticated;
grant execute on function private.committee_for_meeting(uuid) to authenticated;
grant execute on function private.committee_for_group(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.allowed_email_domains enable row level security;
alter table public.committee_roles enable row level security;
alter table public.committees enable row level security;
alter table public.committee_members enable row level security;
alter table public.role_expectations enable row level security;
alter table public.meetings enable row level security;
alter table public.action_items enable row level security;
alter table public.goals enable row level security;
alter table public.resource_groups enable row level security;
alter table public.resource_links enable row level security;
alter table public.system_settings enable row level security;
alter table public.activity_log enable row level security;
alter table public.backup_runs enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (private.is_active_user() and status = 'active')
  or private.is_admin()
);
create policy profiles_admin_insert on public.profiles for insert to authenticated
with check (private.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated
using (private.is_admin());

create policy domains_select on public.allowed_email_domains for select to authenticated
using (private.is_active_user());
create policy domains_admin_insert on public.allowed_email_domains for insert to authenticated
with check (private.is_admin());
create policy domains_admin_update on public.allowed_email_domains for update to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy domains_admin_delete on public.allowed_email_domains for delete to authenticated
using (private.is_admin());

create policy roles_select on public.committee_roles for select to authenticated
using (private.is_active_user());
create policy roles_admin_insert on public.committee_roles for insert to authenticated
with check (private.is_admin());
create policy roles_admin_update on public.committee_roles for update to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy roles_admin_delete on public.committee_roles for delete to authenticated
using (private.is_admin() and not is_system);

create policy committees_select on public.committees for select to authenticated
using (private.can_view_committee(id));
create policy committees_create on public.committees for insert to authenticated
with check (private.is_admin_or_dean() and created_by = (select auth.uid()));
create policy committees_update on public.committees for update to authenticated
using (private.is_admin_or_dean() or private.has_committee_access(id, array['chair']::public.committee_access_level[]))
with check (private.is_admin_or_dean() or private.has_committee_access(id, array['chair']::public.committee_access_level[]));
create policy committees_delete on public.committees for delete to authenticated
using (private.is_admin_or_dean());

create policy memberships_select on public.committee_members for select to authenticated
using (private.is_active_user());
create policy memberships_insert on public.committee_members for insert to authenticated
with check (private.can_manage_roster(committee_id));
create policy memberships_update on public.committee_members for update to authenticated
using (private.can_manage_roster(committee_id)) with check (private.can_manage_roster(committee_id));
create policy memberships_delete on public.committee_members for delete to authenticated
using (private.can_manage_roster(committee_id));

create policy expectations_select on public.role_expectations for select to authenticated
using (private.can_view_committee(committee_id));
create policy expectations_insert on public.role_expectations for insert to authenticated
with check (private.can_manage_roster(committee_id));
create policy expectations_update on public.role_expectations for update to authenticated
using (private.can_manage_roster(committee_id)) with check (private.can_manage_roster(committee_id));
create policy expectations_delete on public.role_expectations for delete to authenticated
using (private.can_manage_roster(committee_id));

create policy meetings_select on public.meetings for select to authenticated
using (private.can_view_committee(committee_id));
create policy meetings_insert on public.meetings for insert to authenticated
with check (private.can_edit_content(committee_id) and created_by = (select auth.uid()));
create policy meetings_update on public.meetings for update to authenticated
using (private.can_edit_content(committee_id)) with check (private.can_edit_content(committee_id));
create policy meetings_delete on public.meetings for delete to authenticated
using (private.can_edit_content(committee_id));

create policy actions_select on public.action_items for select to authenticated
using (private.can_view_committee(private.committee_for_meeting(meeting_id)));
create policy actions_insert on public.action_items for insert to authenticated
with check (
  private.can_edit_content(private.committee_for_meeting(meeting_id))
  and created_by = (select auth.uid())
);
create policy actions_update on public.action_items for update to authenticated
using (private.can_edit_content(private.committee_for_meeting(meeting_id)))
with check (private.can_edit_content(private.committee_for_meeting(meeting_id)));
create policy actions_delete on public.action_items for delete to authenticated
using (private.can_edit_content(private.committee_for_meeting(meeting_id)));

create policy goals_select on public.goals for select to authenticated
using (private.can_view_committee(committee_id));
create policy goals_insert on public.goals for insert to authenticated
with check (private.can_edit_content(committee_id) and created_by = (select auth.uid()));
create policy goals_update on public.goals for update to authenticated
using (private.can_edit_content(committee_id)) with check (private.can_edit_content(committee_id));
create policy goals_delete on public.goals for delete to authenticated
using (private.can_edit_content(committee_id));

create policy resource_groups_select on public.resource_groups for select to authenticated
using (private.can_view_committee(committee_id));
create policy resource_groups_insert on public.resource_groups for insert to authenticated
with check (private.can_edit_content(committee_id));
create policy resource_groups_update on public.resource_groups for update to authenticated
using (private.can_edit_content(committee_id)) with check (private.can_edit_content(committee_id));
create policy resource_groups_delete on public.resource_groups for delete to authenticated
using (private.can_edit_content(committee_id));

create policy resource_links_select on public.resource_links for select to authenticated
using (private.can_view_committee(private.committee_for_group(group_id)));
create policy resource_links_insert on public.resource_links for insert to authenticated
with check (private.can_edit_content(private.committee_for_group(group_id)));
create policy resource_links_update on public.resource_links for update to authenticated
using (private.can_edit_content(private.committee_for_group(group_id)))
with check (private.can_edit_content(private.committee_for_group(group_id)));
create policy resource_links_delete on public.resource_links for delete to authenticated
using (private.can_edit_content(private.committee_for_group(group_id)));

create policy settings_select on public.system_settings for select to authenticated
using (private.is_active_user());
create policy settings_admin_insert on public.system_settings for insert to authenticated
with check (private.is_admin() and updated_by = (select auth.uid()));
create policy settings_admin_update on public.system_settings for update to authenticated
using (private.is_admin()) with check (private.is_admin() and updated_by = (select auth.uid()));
create policy settings_admin_delete on public.system_settings for delete to authenticated
using (private.is_admin());

create policy activity_select on public.activity_log for select to authenticated
using (
  private.is_admin_or_dean()
  or (committee_id is not null and private.can_view_committee(committee_id))
);

create policy backup_admin_select on public.backup_runs for select to authenticated
using (private.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.allowed_email_domains to authenticated;
grant select, insert, update, delete on public.committee_roles to authenticated;
grant select, insert, update, delete on public.committees to authenticated;
grant select, insert, update, delete on public.committee_members to authenticated;
grant select, insert, update, delete on public.role_expectations to authenticated;
grant select, insert, update, delete on public.meetings to authenticated;
grant select, insert, update, delete on public.action_items to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.resource_groups to authenticated;
grant select, insert, update, delete on public.resource_links to authenticated;
grant select, insert, update, delete on public.system_settings to authenticated;
grant select on public.activity_log, public.backup_runs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

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
    resolved_entity_id, resolved_committee_id, jsonb_build_object('label', resolved_label)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger audit_committees after insert or update or delete on public.committees
for each row execute function private.audit_row_change();
create trigger audit_memberships after insert or update or delete on public.committee_members
for each row execute function private.audit_row_change();
create trigger audit_meetings after insert or update or delete on public.meetings
for each row execute function private.audit_row_change();
create trigger audit_actions after insert or update or delete on public.action_items
for each row execute function private.audit_row_change();
create trigger audit_goals after insert or update or delete on public.goals
for each row execute function private.audit_row_change();
create trigger audit_expectations after insert or update or delete on public.role_expectations
for each row execute function private.audit_row_change();
create trigger audit_resource_groups after insert or update or delete on public.resource_groups
for each row execute function private.audit_row_change();
create trigger audit_resource_links after insert or update or delete on public.resource_links
for each row execute function private.audit_row_change();
create trigger audit_roles after insert or update or delete on public.committee_roles
for each row execute function private.audit_row_change();
create trigger audit_domains after insert or update or delete on public.allowed_email_domains
for each row execute function private.audit_row_change();
create trigger audit_settings after insert or update or delete on public.system_settings
for each row execute function private.audit_row_change();

create or replace function public.search_portal(search_text text)
returns table (
  entity_type text,
  entity_id uuid,
  committee_id uuid,
  title text,
  subtitle text,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with query as (
    select websearch_to_tsquery('english', left(trim(search_text), 120)) as value
  )
  select * from (
    select 'person'::text as entity_type, p.id as entity_id, null::uuid as committee_id,
      p.full_name as title, concat_ws(' · ', p.email::text, p.department, p.title) as subtitle,
      ts_rank(p.search_vector, query.value)::real as rank
    from public.profiles p, query
    where char_length(trim(search_text)) >= 2 and p.search_vector @@ query.value and p.status = 'active'
    union all
    select 'committee', c.id, c.id, c.name, c.mandate,
      ts_rank(c.search_vector, query.value)::real
    from public.committees c, query
    where char_length(trim(search_text)) >= 2 and c.search_vector @@ query.value
    union all
    select 'meeting', m.id, m.committee_id, m.title, left(coalesce(nullif(m.agenda, ''), m.minutes), 180),
      ts_rank(m.search_vector, query.value)::real
    from public.meetings m, query
    where char_length(trim(search_text)) >= 2 and m.search_vector @@ query.value
    union all
    select 'action', a.id, m.committee_id, a.task,
      concat('Priority: ', initcap(a.priority::text)), ts_rank(a.search_vector, query.value)::real
    from public.action_items a
    join public.meetings m on m.id = a.meeting_id
    cross join query
    where char_length(trim(search_text)) >= 2 and a.search_vector @@ query.value
    union all
    select 'role', r.id, null::uuid, r.name, initcap(r.access_level::text) || ' access', 1::real
    from public.committee_roles r
    where char_length(trim(search_text)) >= 2 and r.name ilike '%' || trim(search_text) || '%'
  ) results
  order by results.rank desc, results.title
  limit 25;
$$;

revoke all on function public.search_portal(text) from public, anon;
grant execute on function public.search_portal(text) to authenticated;

insert into public.committee_roles (name, access_level, is_system, sort_order) values
  ('Chair', 'chair', true, 10),
  ('Staff', 'staff', true, 20),
  ('Secretary', 'staff', true, 30),
  ('Member', 'member', true, 40),
  ('Observer', 'member', true, 50);

insert into public.system_settings (key, value) values
  ('agenda_template', to_jsonb('1. Call to Order & Attendance Roll Call\n2. Review & Approval of Previous Minutes\n3. Standing Reports\n4. Unfinished Business\n5. New Business\n6. Action Items & Next Steps\n7. Adjournment'::text)),
  ('institution', jsonb_build_object('name', 'Your University', 'support_email', 'support@example.edu'));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activity_log, public.action_items;
  end if;
end $$;
