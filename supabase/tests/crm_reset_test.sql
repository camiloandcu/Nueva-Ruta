begin;
select plan(24);

select lives_ok($$
  select public.reset_synthetic_baseline(
    (select id from public.app_users where role='supervisor' and active limit 1),
    'RESET SYNTHETIC BASELINE',
    'WI-005 deterministic CRM reset test',
    'wi005-crm-reset-one'
  )
$$, 'supervisor reset restores WI-005 preview fixtures');

select is((select count(*)::integer from public.leads), 48, 'reset restores 48 baseline leads');
select is((select count(*)::integer from public.crm_lead_states), 49,
  'reset restores one CRM state per baseline lead plus the SLA fixture');
select is((select count(*)::integer from public.crm_recovery_items where status='open'), 1,
  'reset restores one open missing-phone recovery fixture');
select is((select count(*)::integer from public.operational_escalations where sla_breached), 1,
  'reset restores one visibly overdue escalation SLA fixture');
select is((select count(*)::integer from public.operational_crm_leads where business_id='LEAD-017' and commercial_stage='prequalified'), 1,
  'reset restores a prequalified disposition-ready lead');
select is((select count(*)::integer from public.operational_crm_leads where business_id='LEAD-018' and commercial_stage='prequalified' and fictional_phone is null), 1,
  'reset restores the prequalified missing-phone fixture');
select is((select count(*)::integer from public.source_events where source_event_id='wi005-sla-fixture'), 1,
  'reset restores the synthetic escalation event');
select is((select count(*)::integer from public.outbox_events), 0,
  'reset does not pre-authorize a partner transfer');
select is((select count(*)::integer from public.outbox_delivery_attempts), 0,
  'reset clears attempt history for synthetic delivery state');
select is((select count(*)::integer from public.audit_events where correlation_id='wi005-crm-reset-one' and action='synthetic_crm_fixtures.seeded'), 1,
  'reset records enriched CRM fixture counts in a separate audit event');

select lives_ok($$select public.approve_partner_transfer(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select id from public.crm_lead_states where baseline_lead_id=(select id from public.leads where business_id='LEAD-017')),
  'idempotency_key','wi005-reset-fixture-transfer','reason','Synthetic reset coverage only',
  'correlation_id','wi005-reset-fixture-transfer'
))$$,'test setup creates an explicitly approved synthetic transfer');
select lives_ok($$select public.claim_partner_outbox((select id from public.outbox_events limit 1))$$,
  'test setup claims synthetic delivery work');
select lives_ok($$select public.complete_partner_outbox(jsonb_build_object(
  'event_id',(select id from public.outbox_events limit 1),'attempt_number',1,'started_at',now()::text,
  'outcome','retryable_failure','error_category','synthetic_reset_test','safe_error','test attempt only'
))$$,'test setup records an append-only delivery attempt');
select lives_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select id from public.crm_lead_states where baseline_lead_id=(select id from public.leads where business_id='LEAD-019')),
  'disposition','No Answer','idempotency_key','wi005-reset-fixture-disposition','reason','Synthetic reset test',
  'correlation_id','wi005-reset-fixture-disposition'
))$$,'test setup creates a CRM disposition and draft');
select is((select count(*)::integer from public.outbox_delivery_attempts), 1,
  'test setup confirms accumulated append-only attempt evidence exists');
select is((select count(*)::integer from public.crm_disposition_events), 7,
  'test setup confirms the additional disposition exists alongside six deterministic reporting dispositions');

select lives_ok($$
  select public.reset_synthetic_baseline(
    (select id from public.app_users where role='supervisor' and active limit 1),
    'RESET SYNTHETIC BASELINE',
    'Repeatability check',
    'wi005-crm-reset-two'
  )
$$, 'a second supervisor reset succeeds after CRM and delivery fixture state exists');
select is((select count(*)::integer from public.crm_lead_states), 49,
  'repeated reset produces the same CRM state count');
select is((select count(*)::integer from public.crm_recovery_items where status='open'), 1,
  'repeated reset produces the same recovery fixture count');
select is((select count(*)::integer from public.operational_escalations where sla_breached), 1,
  'repeated reset produces the same overdue escalation fixture count');
select is((select count(*)::integer from public.outbox_events), 0,
  'repeated reset clears the approved delivery transaction');
select is((select count(*)::integer from public.outbox_delivery_attempts), 0,
  'authorized reset clears append-only attempts without clearing general audit events');
select is((select count(*)::integer from public.crm_disposition_events), 6,
  'repeated reset clears prior commands and restores only six deterministic WI-007 timing dispositions');

select * from finish();
rollback;
