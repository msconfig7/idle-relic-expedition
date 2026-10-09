alter table public.players
  add column if not exists essences jsonb not null default '{}'::jsonb;

alter table public.items
  add column if not exists implicit jsonb,
  add column if not exists prefixes jsonb not null default '[]'::jsonb,
  add column if not exists suffixes jsonb not null default '[]'::jsonb,
  add column if not exists special jsonb,
  add column if not exists rank integer not null default 0 check (rank >= 0 and rank <= 10),
  add column if not exists forge_pity integer not null default 0 check (forge_pity >= 0);
