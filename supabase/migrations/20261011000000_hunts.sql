alter table public.players
  add column if not exists hunt jsonb not null default '{}'::jsonb;

alter table public.players
  add column if not exists progress_realm_id integer not null default 1;

update public.players
set progress_realm_id = realm_id
where progress_realm_id = 1
  and realm_id <> 1;
