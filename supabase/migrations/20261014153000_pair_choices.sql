-- One row per person. Shared pair state (round, game, decision) stays on pairs.
-- The Node server calls these functions with the secret key. Browsers have no access.

create table public.pairs (
  code text primary key check (code ~ '^[A-F0-9]{6}$'),
  round integer not null default 1 check (round > 0),
  skipped jsonb not null default '[]'::jsonb check (jsonb_typeof(skipped) = 'array'),
  browse text not null default 'all' check (browse in ('all', 'cook', 'order', 'out')),
  finalists jsonb not null default '[]'::jsonb check (jsonb_typeof(finalists) = 'array'),
  decision jsonb,
  game jsonb,
  updated_at timestamptz not null default now()
);

create table public.people (
  id text primary key,
  pair_code text not null references public.pairs (code) on delete cascade,
  token text not null unique,
  name text not null check (char_length(name) between 1 and 30),
  preferences jsonb check (preferences is null or jsonb_typeof(preferences) = 'object'),
  vote text,
  final_vote text,
  dislikes text not null default '' check (char_length(dislikes) <= 500),
  position smallint not null check (position > 0),
  unique (pair_code, position)
);

create table public.recipes (
  id text primary key,
  pair_code text not null references public.pairs (code) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  position integer not null check (position > 0),
  unique (pair_code, position)
);

create index people_pair_code_idx on public.people (pair_code);
create index recipes_pair_code_idx on public.recipes (pair_code);

alter table public.pairs enable row level security;
alter table public.people enable row level security;
alter table public.recipes enable row level security;

create or replace function public.load_pairs()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_object_agg(p.code, jsonb_build_object(
    'code', p.code,
    'round', p.round,
    'skipped', p.skipped,
    'browse', p.browse,
    'finalists', p.finalists,
    'decision', p.decision,
    'game', p.game,
    'recipes', coalesce((
      select jsonb_agg(r.payload order by r.position)
      from recipes r
      where r.pair_code = p.code
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pe.id,
        'token', pe.token,
        'name', pe.name,
        'preferences', pe.preferences,
        'vote', pe.vote,
        'finalVote', pe.final_vote,
        'dislikes', pe.dislikes
      ) order by pe.position)
      from people pe
      where pe.pair_code = p.code
    ), '[]'::jsonb)
  )), '{}'::jsonb)
  from pairs p;
$$;

create or replace function public.save_pairs(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  codes text[] := array(select key from jsonb_each(coalesce(payload, '{}'::jsonb)));
  pair jsonb;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload must be an object';
  end if;

  delete from pairs where code <> all (codes);

  for pair in select value from jsonb_each(payload)
  loop
    insert into pairs (code, round, skipped, browse, finalists, decision, game)
    values (
      pair->>'code',
      coalesce((pair->>'round')::integer, 1),
      coalesce(pair->'skipped', '[]'::jsonb),
      coalesce(pair->>'browse', 'all'),
      coalesce(pair->'finalists', '[]'::jsonb),
      pair->'decision',
      pair->'game'
    )
    on conflict (code) do update set
      round = excluded.round,
      skipped = excluded.skipped,
      browse = excluded.browse,
      finalists = excluded.finalists,
      decision = excluded.decision,
      game = excluded.game,
      updated_at = now();

    delete from people where pair_code = pair->>'code';
    insert into people (id, pair_code, token, name, preferences, vote, final_vote, dislikes, position)
    select
      person->>'id',
      pair->>'code',
      person->>'token',
      person->>'name',
      case when person->'preferences' = 'null'::jsonb then null else person->'preferences' end,
      person->>'vote',
      person->>'finalVote',
      coalesce(person->>'dislikes', ''),
      ord::smallint
    from jsonb_array_elements(coalesce(pair->'people', '[]'::jsonb)) with ordinality as t(person, ord);

    delete from recipes where pair_code = pair->>'code';
    insert into recipes (id, pair_code, payload, position)
    select recipe->>'id', pair->>'code', recipe, ord::integer
    from jsonb_array_elements(coalesce(pair->'recipes', '[]'::jsonb)) with ordinality as t(recipe, ord);
  end loop;
end;
$$;

revoke all on table public.pairs from anon, authenticated;
revoke all on table public.people from anon, authenticated;
revoke all on table public.recipes from anon, authenticated;
revoke all on function public.load_pairs() from public, anon, authenticated;
revoke all on function public.save_pairs(jsonb) from public, anon, authenticated;
grant all on table public.pairs, public.people, public.recipes to service_role;
grant execute on function public.load_pairs() to service_role;
grant execute on function public.save_pairs(jsonb) to service_role;
