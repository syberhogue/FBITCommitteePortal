alter table public.committees
  add column short_name text not null default '',
  add constraint committees_short_name_length_check
    check (char_length(trim(short_name)) <= 40);

create unique index committees_short_name_unique_idx
  on public.committees (lower(trim(short_name)))
  where char_length(trim(short_name)) > 0;

drop index if exists public.committees_search_idx;

alter table public.committees drop column search_vector;

alter table public.committees add column search_vector tsvector generated always as (
  to_tsvector(
    'english',
    coalesce(name, '') || ' ' || coalesce(short_name, '') || ' ' || coalesce(mandate, '')
  )
) stored;

create index committees_search_idx on public.committees using gin (search_vector);
