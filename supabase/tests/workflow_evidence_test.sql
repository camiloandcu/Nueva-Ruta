begin;
select plan(11);

select has_view('public','operational_assistance_attempts',
  'assistance operations have a minimized traceability view');
select has_function('private','seed_demo_workflow_evidence',
  'the reset wrapper can restore reviewable workflow evidence');
select is((select count(*)::integer from public.source_events where source_event_id like 'example-%'),3,
  'three representative inbound cases are available immediately');
select is((select count(*)::integer from public.processing_decisions decision
  join public.source_events event on event.id=decision.source_event_id
  where event.source_event_id like 'example-%'),3,
  'each representative inbound case retains its decision');
select is((select count(*)::integer from public.response_drafts draft
  join public.processing_decisions decision on decision.id=draft.decision_id
  join public.source_events event on event.id=decision.source_event_id
  where event.source_event_id like 'example-%' and draft.status='pending'),2,
  'two representative cases expose reviewable response drafts');
select is((select count(*)::integer from public.escalations escalation
  join public.processing_decisions decision on decision.id=escalation.decision_id
  join public.source_events event on event.id=decision.source_event_id
  where event.source_event_id='example-revision-legal' and escalation.priority='urgent'),1,
  'the legal-risk case is escalated with urgent priority');
select is((select count(*)::integer from public.operational_assistance_attempts
  where source_event_id like 'example-%'),3,
  'every representative inbound case has an assistance audit entry');
select ok(not has_function_privilege('anon','private.seed_demo_workflow_evidence()','EXECUTE'),
  'anonymous callers cannot reseed workflow evidence');

select lives_ok($$
  select public.reset_synthetic_baseline(
    (select id from public.app_users where role='supervisor' and active limit 1),
    'RESET SYNTHETIC BASELINE','workflow evidence reset test','workflow-evidence-reset'
  )
$$, 'supervisor reset restores the workflow examples');
select is((select count(*)::integer from public.source_events where source_event_id like 'example-%'),3,
  'reset restores all representative inbound cases');
select is((select count(*)::integer from public.crm_lead_states),52,
  'reset restores CRM states for representative inbound cases');

select * from finish();
rollback;
