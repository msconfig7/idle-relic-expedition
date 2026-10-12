alter table public.players
  add column if not exists hunt_seal_board integer not null default 0 check (hunt_seal_board >= 0);

alter table public.players
  add column if not exists hunt_seal_rewarded_at timestamptz;

create or replace function public.protect_diamonds()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and auth.role() = 'authenticated'
    and NEW.diamonds is distinct from OLD.diamonds
    and coalesce(current_setting('app.allow_diamond_grant', true), '') is distinct from 'hunt-seal'
  then
    raise exception 'Diamonds are server-managed';
  end if;
  return NEW;
end;
$$;

create or replace function public.protect_hunt_seal()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and auth.role() = 'authenticated'
    and coalesce(current_setting('app.allow_diamond_grant', true), '') is distinct from 'hunt-seal'
    and (
      NEW.hunt_seal_board is distinct from OLD.hunt_seal_board
      or NEW.hunt_seal_rewarded_at is distinct from OLD.hunt_seal_rewarded_at
    )
  then
    raise exception 'Hunt seal rewards are server-managed';
  end if;
  return NEW;
end;
$$;

drop trigger if exists players_protect_hunt_seal on public.players;

create trigger players_protect_hunt_seal
before update of hunt_seal_board, hunt_seal_rewarded_at
on public.players
for each row
execute function public.protect_hunt_seal();

create or replace function public.award_hunt_seal()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.players%rowtype;
  hunt jsonb;
  contracts jsonb;
  contract jsonb;
  board integer;
  idx integer;
  granted bigint;
begin
  if uid is null then
    raise exception 'Unauthorized';
  end if;

  select * into row
  from public.players
  where id = uid
  for update;

  if not found then
    raise exception 'Player not found';
  end if;

  hunt := coalesce(row.hunt, '{}'::jsonb);
  board := floor(coalesce((hunt->>'board')::numeric, 0))::integer;
  if board < 1 then
    raise exception 'Hunt board is not sealed';
  end if;

  if board <= row.hunt_seal_board then
    return row.diamonds;
  end if;

  if board <> row.hunt_seal_board + 1 then
    raise exception 'Hunt board is out of order';
  end if;

  if row.hunt_seal_rewarded_at is not null
    and row.hunt_seal_rewarded_at > now() - interval '2 hours' then
    raise exception 'Hunt seal reward is cooling down';
  end if;

  contracts := hunt->'contracts';
  if jsonb_typeof(contracts) <> 'array' or jsonb_array_length(contracts) <> 3 then
    raise exception 'Hunt board is not sealed';
  end if;

  for idx in 0..2 loop
    contract := contracts->idx;
    if coalesce((contract->>'claimed')::boolean, false) is distinct from true then
      raise exception 'Hunt board is not sealed';
    end if;
    if coalesce((contract->>'progress')::numeric, 0) < coalesce((contract->>'target')::numeric, 1) then
      raise exception 'Hunt board is not sealed';
    end if;
  end loop;

  perform set_config('app.allow_diamond_grant', 'hunt-seal', true);

  update public.players
  set
    diamonds = diamonds + 3,
    hunt_seal_board = board,
    hunt_seal_rewarded_at = now()
  where id = uid
  returning diamonds into granted;

  return granted;
end;
$$;

revoke all on function public.award_hunt_seal() from public;
grant execute on function public.award_hunt_seal() to authenticated;
