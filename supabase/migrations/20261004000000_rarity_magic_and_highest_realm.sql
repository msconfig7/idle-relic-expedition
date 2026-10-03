-- Rename uncommon rarity to magic and track the farthest opened realm.

alter type public.rarity rename value 'uncommon' to 'magic';

alter table public.players
  add column if not exists highest_realm_id integer not null default 1;

update public.players
  set highest_realm_id = greatest(highest_realm_id, realm_id);
