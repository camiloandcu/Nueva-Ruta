begin;
select plan(23);

select has_column('public','source_events','creator_id','new inbound events retain the original creator foreign key');
select is((select version from public.rule_versions where active),2,'schema version 2 is the active stalled-work policy');
select is((select active::integer from public.rule_versions where version=1),0,'prior rule version remains present and inactive');
select ok(not ((select content from public.rule_versions where version=1) ? 'stalled_work'),'prior policy content is not rewritten');
select is((select content #>> '{stalled_work,approaching_ratio}' from public.rule_versions where active),'0.8','approaching ratio is versioned');

select lives_ok($$
  select public.reset_synthetic_baseline(
    (select id from public.app_users where role='supervisor' and active limit 1),
    'RESET SYNTHETIC BASELINE','WI-007 reporting fixture test','wi007-reset-test'
  )
$$,'report fixtures reset transactionally');
select is((select count(*)::integer from public.crm_lead_states),52,'reset preserves baseline, escalation and reviewable inbound lead states');
select is((select count(*)::integer from public.crm_disposition_events where idempotency_key like 'wi007-callback-%'),3,'three callback timing cases are seeded');
select is((select count(*)::integer from public.crm_disposition_events where idempotency_key like 'wi007-info-sent-%'),3,'three Info Sent timing cases are seeded');
select is((select count(*)::integer from public.partner_transfers),0,'reporting reset does not pre-authorize partner transfers');
select is((select count(*)::integer from public.outbox_events),0,'reporting reset does not create delivery work');
select is((select count(*)::integer from public.partner_reconciliation_cases),28,'reset retains every canonical partner case');
select is((select count(*)::integer from public.partner_reconciliation_cases where updated_at='2026-09-15 17:00:00+00'),1,'one reconciliation case begins within its threshold');
select is((select count(*)::integer from public.partner_reconciliation_cases where updated_at='2026-09-11 17:30:00+00'),1,'one reconciliation case is approaching its threshold');
select is((select count(*)::integer from public.partner_reconciliation_cases where updated_at='2026-09-11 17:00:00+00'),1,'one reconciliation case has reached its threshold');

select lives_ok($$select public.operational_reporting_facts((select id from public.app_users where role='analyst' and active limit 1))$$,
  'analyst may request the minimized reporting fact snapshot');
select ok(not (public.operational_reporting_facts((select id from public.app_users where role='analyst' and active limit 1))::text ~ 'fictional_phone|source_values|redacted_body'),
  'report fact snapshot excludes raw phone, raw partner values and message details');
select throws_ok($$select public.operational_reporting_facts('00000000-0000-0000-0000-000000000000')$$,
  '42501','active reporting role required','unknown actor cannot read reporting facts');

select lives_ok($$select public.ingest_source_event(jsonb_build_object(
  'event',jsonb_build_object('channel','ctwa','source_event_id','wi007-creator-attribution-test','inbound_at','2026-09-15 17:00:00+00',
    'source_detail','WI-007 synthetic test','creator_business_id','CR-001','fictional_phone','+15550199',
    'consent',jsonb_build_object('status','granted','source','synthetic','conversation_window_open',true),'correlation_id','wi007-creator-test'),
  'result',jsonb_build_object('lead_id',gen_random_uuid(),'decision_id',gen_random_uuid(),'decision','respond','reason_code','test',
    'decision_source','deterministic','ai_attempt_status','skipped_configuration','failure_layer','configuration','normalized_reason','no_key',
    'correlation_id','wi007-creator-test','extracted_fields',jsonb_build_object('state','TX')),
  'restricted_body','Synthetic test only','redacted_body','Synthetic test only','redaction_types','[]'::jsonb,'explanation','Synthetic test',
  'attempt',jsonb_build_object('provider','none','model','','prompt_version','test','safe_metadata','{}'::jsonb)
))$$,'CTWA ingestion persists its original creator attribution');
select is((select creator.business_id from public.source_events event join public.creators creator on creator.id=event.creator_id
  where event.source_event_id='wi007-creator-attribution-test'),'CR-001','creator attribution is not lost in the ingestion transaction');
select throws_ok($$insert into public.source_events(id,channel,source_event_id,inbound_at,source_detail,fictional_phone,consent_context,correlation_id)
  values(gen_random_uuid(),'ctwa','wi007-missing-creator','2026-09-15 17:00+00','test','+15550198','{"status":"granted"}','wi007-missing-creator')$$,
  '23514',null,'database rejects new CTWA rows without original creator attribution');

select ok(has_function_privilege('service_role','public.operational_reporting_facts(uuid)','EXECUTE'),'service role can invoke reporting facts');
select ok(not has_function_privilege('anon','public.operational_reporting_facts(uuid)','EXECUTE'),'anonymous role cannot invoke reporting facts');

select * from finish();
rollback;
