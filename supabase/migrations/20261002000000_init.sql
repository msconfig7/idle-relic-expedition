-- Idle Relic Expedition initial schema

create type public.equip_slot as enum (
  'helmet',
  'amulet',
  'weapon_main',
  'weapon_offhand',
  'armour',
  'belt',
  'ring_1',
  'ring_2',
  'gloves',
  'boots'
);

create type public.slot_type as enum (
  'helmet',
  'amulet',
  'weapon',
  'armour',
  'belt',
  'ring',
  'gloves',
  'boots'
);

create type public.weapon_hand as enum ('one_hand', 'two_hand', 'offhand');

create type public.rarity as enum ('common', 'uncommon', 'rare', 'epic', 'legendary');

create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  level integer not null default 1 check (level >= 1),
  xp bigint not null default 0 check (xp >= 0),
  gold bigint not null default 0 check (gold >= 0),
  diamonds bigint not null default 50 check (diamonds >= 0),
  scrap bigint not null default 0 check (scrap >= 0),
  realm_id integer not null default 1,
  realm_progress integer not null default 0 check (realm_progress >= 0 and realm_progress <= 10000),
  skill_points_unspent integer not null default 3 check (skill_points_unspent >= 0),
  allocated_node_ids integer[] not null default array[0],
  last_settled_at timestamptz not null default now(),
  content_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  slot_type public.slot_type not null,
  weapon_hand public.weapon_hand,
  rarity public.rarity not null,
  base_id text not null,
  name text not null,
  affixes jsonb not null default '[]'::jsonb,
  equipped_slot public.equip_slot,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index items_one_per_slot
  on public.items (player_id, equipped_slot)
  where equipped_slot is not null;

create index items_player_id on public.items (player_id);

create or replace function public.slot_matches_type(eq public.equip_slot, st public.slot_type)
returns boolean
language sql
immutable
as $$
  select case
    when st = 'helmet' then eq = 'helmet'
    when st = 'amulet' then eq = 'amulet'
    when st = 'armour' then eq = 'armour'
    when st = 'belt' then eq = 'belt'
    when st = 'gloves' then eq = 'gloves'
    when st = 'boots' then eq = 'boots'
    when st = 'ring' then eq in ('ring_1', 'ring_2')
    when st = 'weapon' then eq in ('weapon_main', 'weapon_offhand')
    else false
  end;
$$;

alter table public.items
  add constraint items_slot_consistency
  check (equipped_slot is null or public.slot_matches_type(equipped_slot, slot_type));

alter table public.items
  add constraint items_two_hand_main
  check (weapon_hand is distinct from 'two_hand' or equipped_slot is null or equipped_slot = 'weapon_main');

alter table public.items
  add constraint items_offhand_slot
  check (weapon_hand is distinct from 'offhand' or equipped_slot is null or equipped_slot = 'weapon_offhand');

create or replace function public.enforce_weapon_hands()
returns trigger
language plpgsql
as $$
begin
  if NEW.equipped_slot = 'weapon_offhand' then
    if exists (
      select 1
      from public.items
      where player_id = NEW.player_id
        and id is distinct from NEW.id
        and equipped_slot = 'weapon_main'
        and weapon_hand = 'two_hand'
    ) then
      raise exception 'Two-handed weapon occupies both hands';
    end if;
  end if;

  if NEW.weapon_hand = 'two_hand' and NEW.equipped_slot = 'weapon_main' then
    update public.items
    set equipped_slot = null
    where player_id = NEW.player_id
      and equipped_slot = 'weapon_offhand'
      and id is distinct from NEW.id;
  end if;

  return NEW;
end;
$$;

create trigger items_weapon_hands
before insert or update of equipped_slot, weapon_hand
on public.items
for each row
execute function public.enforce_weapon_hands();

create or replace function public.protect_diamonds()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and auth.role() = 'authenticated'
    and NEW.diamonds is distinct from OLD.diamonds then
    raise exception 'Diamonds are server-managed';
  end if;
  return NEW;
end;
$$;

create trigger players_protect_diamonds
before update of diamonds
on public.players
for each row
execute function public.protect_diamonds();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger players_updated_at
before update on public.players
for each row
execute function public.touch_updated_at();

alter table public.players enable row level security;
alter table public.items enable row level security;

create policy players_own on public.players
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy items_own on public.items
  for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.players (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
