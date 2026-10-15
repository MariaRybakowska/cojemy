alter table public.pairs add column if not exists version integer not null default 0;
alter table public.pairs add column if not exists notice jsonb;

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
    'version', p.version,
    'notice', p.notice,
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
  current_version integer;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload must be an object';
  end if;

  for pair in select value from jsonb_each(payload)
  loop
    if pair ? 'baseVersion' then
      select version into current_version from pairs where code = pair->>'code';
      if found and current_version is distinct from coalesce((pair->>'baseVersion')::integer, -1) then
        raise exception 'stale pair';
      end if;
    end if;
  end loop;

  delete from pairs where code <> all (codes);

  for pair in select value from jsonb_each(payload)
  loop
    insert into pairs (code, round, skipped, browse, finalists, decision, game, version, notice)
    values (
      pair->>'code',
      coalesce((pair->>'round')::integer, 1),
      coalesce(pair->'skipped', '[]'::jsonb),
      coalesce(pair->>'browse', 'all'),
      coalesce(pair->'finalists', '[]'::jsonb),
      pair->'decision',
      pair->'game',
      coalesce((pair->>'version')::integer, 0),
      pair->'notice'
    )
    on conflict (code) do update set
      round = excluded.round,
      skipped = excluded.skipped,
      browse = excluded.browse,
      finalists = excluded.finalists,
      decision = excluded.decision,
      game = excluded.game,
      version = excluded.version,
      notice = excluded.notice,
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

revoke all on function public.load_pairs() from public, anon, authenticated;
revoke all on function public.save_pairs(jsonb) from public, anon, authenticated;
grant execute on function public.load_pairs() to service_role;
grant execute on function public.save_pairs(jsonb) to service_role;
