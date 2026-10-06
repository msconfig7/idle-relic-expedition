alter table public.players
  add column if not exists monster_index integer not null default 0 check (monster_index >= 0);

alter table public.players
  add column if not exists queued_monster_index integer not null default 0 check (queued_monster_index >= 0);
