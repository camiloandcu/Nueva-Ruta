begin;
select plan(28);

select has_table('public','crm_message_delivery_events','simulated message deliveries are durable');
select has_view('public','operational_crm_message_evidence','approved case evidence has a read model');
select has_function('public','record_simulated_message_delivery',array['jsonb'],'delivery command is transaction backed');

create temp table message_fixture as
select state.id as lead_id, draft.id as draft_id,
  row_number() over (order by state.business_id) as n
from public.crm_lead_states state
join public.processing_decisions decision on decision.source_event_id=state.source_event_id
join public.response_drafts draft on draft.decision_id=decision.id
where draft.status='pending';

select is((select count(*)::integer from public.operational_crm_message_evidence
  where crm_lead_id=(select lead_id from message_fixture where n=1)),
  0,'pending intake content is not exposed as approved evidence');
select lives_ok($$select public.review_response_draft(
  (select draft_id from message_fixture where n=1),
  (select id from public.app_users where role='operator' and active limit 1),
  'Hola, esta es una respuesta aprobada para este caso.',
  encode(extensions.digest('Hola, esta es una respuesta aprobada para este caso.','sha256'),'hex'),
  array[]::text[],'crm-delivery-review'
)$$,'operator can approve the intake draft');
select is((select count(*)::integer from public.operational_crm_message_evidence
  where crm_lead_id=(select lead_id from message_fixture where n=1)),
  1,'approved intake draft appears only under its CRM case');
select is((select content from public.operational_crm_message_evidence
  where crm_lead_id=(select lead_id from message_fixture where n=1)),
  'Hola, esta es una respuesta aprobada para este caso.',
  'case evidence displays approved content');
select is((select count(*)::integer from public.operational_crm_message_evidence
  where crm_lead_id=(select lead_id from message_fixture where n=2)),
  0,'another case cannot list this draft');

select throws_ok($$select public.record_simulated_message_delivery(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=1),
  'draft_kind','intake','draft_id',(select draft_id from message_fixture where n=1),
  'idempotency_key','crm-delivery-before-qualify','correlation_id','crm-delivery-test'
))$$,'22023',null,'under-review case must be qualified before delivery');
select lives_ok($$select public.qualify_crm_lead(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=1),
  'reason','Synthetic qualification','correlation_id','crm-delivery-qualify-1'
))$$,'first case can be qualified');
select lives_ok($$select public.qualify_crm_lead(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=2),
  'reason','Synthetic qualification','correlation_id','crm-delivery-qualify-2'
))$$,'second case can be qualified');
select throws_ok($$select public.record_simulated_message_delivery(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=2),
  'draft_kind','intake','draft_id',(select draft_id from message_fixture where n=1),
  'idempotency_key','crm-delivery-wrong-case','correlation_id','crm-delivery-test'
))$$,'22023',null,'cross-case delivery is rejected');
select throws_ok($$select public.record_simulated_message_delivery(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=2),
  'draft_kind','intake','draft_id',(select draft_id from message_fixture where n=2),
  'idempotency_key','crm-delivery-pending-draft','correlation_id','crm-delivery-test'
))$$,'22023',null,'pending draft cannot be delivered');
select lives_ok($$select public.record_simulated_message_delivery(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=1),
  'draft_kind','intake','draft_id',(select draft_id from message_fixture where n=1),
  'idempotency_key','crm-delivery-valid-intake','correlation_id','crm-delivery-test'
))$$,'approved intake draft can be recorded as simulated delivery');
select is((select count(*)::integer from public.crm_message_delivery_events
  where idempotency_key='crm-delivery-valid-intake'),1,'one delivery row is stored');
select is((select public.record_simulated_message_delivery(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=1),
  'draft_kind','intake','draft_id',(select draft_id from message_fixture where n=1),
  'idempotency_key','crm-delivery-valid-intake','correlation_id','crm-delivery-test'
))->>'replayed'),'true','same idempotency key replays without another delivery');
select throws_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=1),
  'disposition','Info Sent','draft_id',(select draft_id from message_fixture where n=1),
  'idempotency_key','crm-info-approved-only','reason','Approval alone','correlation_id','crm-delivery-test'
))$$,'22023',null,'approval alone does not mark Info Sent');
select throws_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=2),
  'disposition','Info Sent','delivery_event_id',(select id from public.crm_message_delivery_events where idempotency_key='crm-delivery-valid-intake'),
  'idempotency_key','crm-info-wrong-case','reason','Wrong case','correlation_id','crm-delivery-test'
))$$,'22023',null,'another case cannot reuse delivery evidence');
select is((select commercial_stage::text from public.crm_lead_states
  where id=(select lead_id from message_fixture where n=2)),
  'prequalified','rejected cross-case command does not advance stage');
select lives_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=1),
  'disposition','Info Sent','delivery_event_id',(select id from public.crm_message_delivery_events where idempotency_key='crm-delivery-valid-intake'),
  'idempotency_key','crm-info-valid-intake','reason','Simulated delivery recorded','correlation_id','crm-delivery-test'
))$$,'same-case simulated delivery can mark Info Sent');
select is((select side_effect_status from public.crm_disposition_events
  where idempotency_key='crm-info-valid-intake'),'simulated_delivery',
  'disposition audit identifies simulated delivery');
select is((select delivery_event_id from public.operational_crm_message_evidence
  where crm_lead_id=(select lead_id from message_fixture where n=1)),
  (select id from public.crm_message_delivery_events where idempotency_key='crm-delivery-valid-intake'),
  'case evidence links the recorded delivery');
select throws_ok($$select public.record_simulated_message_delivery(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='analyst' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=1),
  'draft_kind','intake','draft_id',(select draft_id from message_fixture where n=1),
  'idempotency_key','crm-delivery-valid-intake','correlation_id','crm-delivery-test'
))$$,'42501',null,'unauthorized actor cannot replay an existing delivery');
select throws_ok($$select public.record_simulated_message_delivery(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=2),
  'draft_kind','intake','draft_id',(select draft_id from message_fixture where n=2),
  'idempotency_key','crm-delivery-valid-intake','correlation_id','crm-delivery-test'
))$$,'22023',null,'idempotency key cannot be reused for another case');
select lives_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=2),
  'disposition','Info Sent','external_action_reference','documented-manual-001',
  'idempotency_key','crm-info-manual-001','reason','Documented manual action','correlation_id','crm-delivery-test'
))$$,'documented manual action remains a distinct Info Sent route');
select is((select side_effect_status from public.crm_disposition_events
  where idempotency_key='crm-info-manual-001'),'manual_action_recorded',
  'manual action is labeled separately from simulated delivery');
update public.crm_lead_states set opted_out_at=now() where id=(select lead_id from message_fixture where n=2);
select throws_ok($$select public.record_simulated_message_delivery(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=2),
  'draft_kind','intake','draft_id',(select draft_id from message_fixture where n=1),
  'idempotency_key','crm-delivery-opted-out','correlation_id','crm-delivery-test'
))$$,'22023',null,'opted-out case cannot record simulated delivery');
update public.response_drafts set status='pending'
  where id=(select draft_id from message_fixture where n=1);
select throws_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select lead_id from message_fixture where n=1),
  'disposition','Info Sent','delivery_event_id',(select id from public.crm_message_delivery_events where idempotency_key='crm-delivery-valid-intake'),
  'idempotency_key','crm-info-changed-approval','reason','Changed approval','correlation_id','crm-delivery-test'
))$$,'22023',null,'disposition rechecks approved draft state after delivery');

select * from finish();
rollback;
