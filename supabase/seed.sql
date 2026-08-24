-- Local development seed. Never use these credentials in production.
insert into public.allowed_email_domains (domain) values ('fbit.test')
on conflict (domain) do update set enabled = true;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
  email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated', email,
  crypt('FbitPortal123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name), now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'admin@fbit.test', 'Alex Administrator'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'dean@fbit.test', 'Dana Dean'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'chair@fbit.test', 'Casey Chair'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'staff@fbit.test', 'Sam Staff'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'member@fbit.test', 'Morgan Member'),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'unassigned@fbit.test', 'Uma Unassigned'),
  ('00000000-0000-0000-0000-000000000007'::uuid, 'pending@fbit.test', 'Pat Pending'),
  ('00000000-0000-0000-0000-000000000008'::uuid, 'suspended@fbit.test', 'Sid Suspended')
) as seed_users(user_id, email, full_name)
on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  user_id, user_id::text, user_id,
  jsonb_build_object('sub', user_id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'admin@fbit.test'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'dean@fbit.test'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'chair@fbit.test'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'staff@fbit.test'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'member@fbit.test'),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'unassigned@fbit.test'),
  ('00000000-0000-0000-0000-000000000007'::uuid, 'pending@fbit.test'),
  ('00000000-0000-0000-0000-000000000008'::uuid, 'suspended@fbit.test')
) as seed_identities(user_id, email)
on conflict (provider_id, provider) do nothing;

update public.profiles set
  status = 'active', global_role = 'admin', person_category = 'admin',
  department = 'Information Technology', title = 'Portal Administrator'
where id = '00000000-0000-0000-0000-000000000001';

update public.profiles set
  status = 'active', global_role = 'dean', person_category = 'admin',
  department = 'Faculty Office', title = 'Dean'
where id = '00000000-0000-0000-0000-000000000002';

update public.profiles set
  status = 'active', global_role = 'faculty', person_category = 'faculty',
  department = 'Computer Science', title = 'Professor'
where id in (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006'
);

update public.profiles set
  status = 'active', global_role = 'staff', person_category = 'staff',
  department = 'Academic Services', title = 'Program Coordinator'
where id = '00000000-0000-0000-0000-000000000004';

update public.profiles set status = 'suspended'
where id = '00000000-0000-0000-0000-000000000008';

insert into public.committees (id, name, mandate, created_by, color) values
  (
    '10000000-0000-0000-0000-000000000001',
    'Curriculum Review Committee',
    'Evaluate and approve course proposals, program changes, and degree requirements.',
    '00000000-0000-0000-0000-000000000001',
    '#003C71'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Faculty Technology Committee',
    'Guide technology priorities, policy, and service improvements across the faculty.',
    '00000000-0000-0000-0000-000000000002',
    '#007F86'
  );

insert into public.committee_members (committee_id, profile_id, role_id)
select membership.committee_id, membership.profile_id, role.id
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Chair'),
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'Staff'),
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'Member'),
  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'Secretary')
) as membership(committee_id, profile_id, role_name)
join public.committee_roles role on role.name = membership.role_name;

insert into public.role_expectations (committee_id, role_id, expectation_text)
select '10000000-0000-0000-0000-000000000001', id,
  case name
    when 'Chair' then 'Facilitate meetings, approve agendas, and report decisions.'
    when 'Staff' then 'Prepare materials, record decisions, and follow up on action items.'
    when 'Member' then 'Review proposals before meetings and participate in decisions.'
    else ''
  end
from public.committee_roles
where name in ('Chair', 'Staff', 'Member');

insert into public.meetings (
  id, committee_id, title, starts_at, status, agenda, minutes, created_by
) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Fall Planning Session',
  '2026-09-15 14:00:00-04',
  'planned',
  'Review curriculum proposals and confirm the fall work plan.',
  '',
  '00000000-0000-0000-0000-000000000003'
);

insert into public.meeting_agenda_items (id, meeting_id, title, sort_order) values
  (
    '21000000-0000-4000-8000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Review curriculum proposals',
    10
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'Confirm the fall work plan',
    20
  );

insert into public.meeting_agenda_item_assignees (agenda_item_id, profile_id) values
  ('21000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000003'),
  ('21000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000004');

set role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',
  false
);
update public.meetings
set status = 'scheduled',
    finalized_at = now(),
    finalized_by = '00000000-0000-0000-0000-000000000003'
where id = '20000000-0000-0000-0000-000000000001';
reset role;

insert into public.goals (committee_id, title, target_date, created_by) values
  (
    '10000000-0000-0000-0000-000000000001',
    'Integrate responsible AI learning outcomes into core courses',
    '2026-12-01',
    '00000000-0000-0000-0000-000000000003'
  );

insert into public.resource_groups (id, committee_id, name, sort_order) values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Official Guidelines & Handbooks',
    10
  );

insert into public.resource_links (group_id, title, url, description, sort_order) values
  (
    '30000000-0000-0000-0000-000000000001',
    'Course Catalogue Policies',
    'https://example.edu/policies/catalogue',
    'University requirements for course and program changes.',
    10
  );
