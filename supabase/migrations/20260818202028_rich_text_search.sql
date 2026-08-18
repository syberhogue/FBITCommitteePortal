create or replace function private.rich_text_plain(source text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  document jsonb;
  result text;
begin
  if source is null or source = '' then
    return '';
  end if;

  begin
    document := source::jsonb;
  exception when others then
    return source;
  end;

  select string_agg(item.value #>> '{}', ' ' order by item.ordinality)
    into result
  from jsonb_path_query(document, 'strict $.**.text') with ordinality as item(value, ordinality);

  return coalesce(result, '');
end;
$$;

revoke all on function private.rich_text_plain(text) from public, anon;
grant execute on function private.rich_text_plain(text) to authenticated;

drop index public.meetings_search_idx;
alter table public.meetings drop column search_vector;
alter table public.meetings add column search_vector tsvector generated always as (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    private.rich_text_plain(agenda) || ' ' ||
    private.rich_text_plain(minutes)
  )
) stored;
create index meetings_search_idx on public.meetings using gin (search_vector);

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
    select 'meeting', m.id, m.committee_id, m.title,
      left(concat_ws(' · ', private.rich_text_plain(m.agenda), private.rich_text_plain(m.minutes)), 180),
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
