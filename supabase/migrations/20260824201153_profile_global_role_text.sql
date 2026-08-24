alter table public.profiles
  alter column global_role drop default;

alter table public.profiles
  alter column global_role type text using global_role::text;

alter table public.profiles
  alter column global_role set default 'faculty';

alter table public.profiles
  add constraint profiles_global_role_not_blank
  check (char_length(trim(global_role)) between 1 and 120);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'
      and lower(p.global_role) = 'admin'
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
    where p.id = (select auth.uid())
      and p.status = 'active'
      and lower(p.global_role) in ('admin', 'dean', 'ad')
  );
$$;
