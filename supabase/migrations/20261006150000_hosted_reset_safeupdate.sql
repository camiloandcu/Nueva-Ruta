-- Hosted PostgREST enables pg_safeupdate. The supervisor-only reset chain
-- intentionally clears fixture tables, so make that intent explicit in each
-- DELETE without weakening the connection's safety setting.
do $$
declare
  function_row record;
  definition text;
  guarded_definition text;
  changed_functions integer := 0;
begin
  for function_row in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'reset_synthetic_baseline%'
      and pg_get_function_identity_arguments(p.oid) =
        'p_actor_id uuid, p_confirmation text, p_reason text, p_correlation_id text'
  loop
    definition := pg_get_functiondef(function_row.oid);
    guarded_definition := regexp_replace(
      definition,
      '(?i)(delete[[:space:]]+from[[:space:]]+public\.[[:alnum:]_]+)[[:space:]]*;',
      '\1 where true;',
      'g'
    );
    if guarded_definition <> definition then
      execute guarded_definition;
      changed_functions := changed_functions + 1;
    end if;
  end loop;
  if changed_functions <> 5 then
    raise exception 'Expected five synthetic reset functions with unqualified deletes, found %',
      changed_functions;
  end if;
end;
$$;
