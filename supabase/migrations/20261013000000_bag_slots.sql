-- Bag expansions. Costs stay aligned with src/game/bag.ts.

alter table public.players
  add column if not exists bag_level integer not null default 1
  check (bag_level >= 1 and bag_level <= 10);

create or replace function public.protect_diamonds()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and auth.role() = 'authenticated'
    and NEW.diamonds is distinct from OLD.diamonds
    and coalesce(current_setting('app.allow_diamond_grant', true), '') not in ('hunt-seal', 'bag-expand')
  then
    raise exception 'Diamonds are server-managed';
  end if;
  return NEW;
end;
$$;

create or replace function public.protect_bag_level()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and auth.role() = 'authenticated'
    and NEW.bag_level is distinct from OLD.bag_level
    and coalesce(current_setting('app.allow_diamond_grant', true), '') is distinct from 'bag-expand'
  then
    raise exception 'Bag expansions are server-managed';
  end if;
  return NEW;
end;
$$;

drop trigger if exists players_protect_bag_level on public.players;

create trigger players_protect_bag_level
before update of bag_level
on public.players
for each row
execute function public.protect_bag_level();

create or replace function public.expand_bag(pay_with text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.players%rowtype;
  next_level integer;
  gold_cost bigint;
  diamond_cost bigint;
  new_gold bigint;
  new_diamonds bigint;
begin
  if uid is null then
    raise exception 'Unauthorized';
  end if;

  if pay_with is distinct from 'gold' and pay_with is distinct from 'diamonds' then
    raise exception 'Unknown payment';
  end if;

  select * into row
  from public.players
  where id = uid
  for update;

  if not found then
    raise exception 'Player not found';
  end if;

  if row.bag_level >= 10 then
    raise exception 'This bag is fully expanded';
  end if;

  next_level := row.bag_level + 1;

  gold_cost := case row.bag_level
    when 1 then 20000
    when 2 then 50000
    when 3 then 100000
    when 4 then 200000
    else null
  end;

  diamond_cost := case
    when row.bag_level between 1 and 5 then 5
    when row.bag_level = 6 then 10
    when row.bag_level = 7 then 15
    when row.bag_level = 8 then 20
    when row.bag_level = 9 then 25
    else null
  end;

  if pay_with = 'gold' then
    if gold_cost is null then
      raise exception 'This expansion costs diamonds';
    end if;
    if row.gold < gold_cost then
      raise exception 'Not enough gold';
    end if;
    new_gold := row.gold - gold_cost;
    new_diamonds := row.diamonds;
  else
    if diamond_cost is null or row.diamonds < diamond_cost then
      raise exception 'Not enough diamonds';
    end if;
    new_gold := row.gold;
    new_diamonds := row.diamonds - diamond_cost;
  end if;

  perform set_config('app.allow_diamond_grant', 'bag-expand', true);

  update public.players
  set
    gold = new_gold,
    diamonds = new_diamonds,
    bag_level = next_level
  where id = uid;

  return jsonb_build_object(
    'bag_level', next_level,
    'gold', new_gold,
    'diamonds', new_diamonds
  );
end;
$$;

revoke all on function public.expand_bag(text) from public;
grant execute on function public.expand_bag(text) to authenticated;
