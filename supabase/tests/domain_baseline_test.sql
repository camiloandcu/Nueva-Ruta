begin;

do $$
declare
  expected jsonb := '{"creators":5,"content_sources":10,"leads":48,"messages":48,"consent":48,"partner_rows":30}'::jsonb;
  actual jsonb;
begin
  actual := jsonb_build_object(
    'creators', (select count(*) from public.creators),
    'content_sources', (select count(*) from public.content_sources),
    'leads', (select count(*) from public.leads),
    'messages', (select count(*) from public.messages),
    'consent', (select count(*) from public.consent_evidence),
    'partner_rows', (select count(*) from public.raw_partner_rows)
  );
  if actual <> expected then
    raise exception 'fixture counts differ: expected %, got %', expected, actual;
  end if;
  if (select count(*) from public.leads where fictional_phone !~ '^\+155501[0-9]{2}$') <> 0 then
    raise exception 'a lead phone violates the fictional 555-01xx convention';
  end if;
  if (select count(distinct business_id) from public.leads) <> 48 then
    raise exception 'lead business identifiers are not unique';
  end if;
  if (select count(*) from public.leads where not synthetic) <> 0 then
    raise exception 'non-synthetic lead found in bundled baseline';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.leads (
      id, business_id, creator_id, content_source_id, source_event_id, received_at,
      reference_instant, channel, source_detail, fictional_phone, initial_status, case_tags
    ) values (
      gen_random_uuid(), 'LEAD-999', gen_random_uuid(), null, 'invalid-parent-test',
      '2026-09-15 16:00:00+00', '2026-09-15 17:00:00+00', 'ctwa',
      'synthetic constraint test', '+15550199', 'received', array['constraint_test']
    );
    raise exception 'invalid creator relationship was accepted';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    update public.raw_partner_rows set row_number = 999 where row_number = 1;
    raise exception 'raw partner provenance mutation was accepted';
  exception
    when others then
      if sqlerrm = 'raw partner provenance mutation was accepted' then raise; end if;
  end;
end;
$$;

rollback;
