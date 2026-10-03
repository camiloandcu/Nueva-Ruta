begin;
select plan(51);

select has_table('public','crm_lead_states','commercial state is persisted separately');
select has_table('public','crm_disposition_events','dispositions retain audit evidence');
select has_table('public','crm_follow_up_drafts','No Answer can create a human-reviewed draft');
select has_table('public','partner_transfers','approved transfers have durable identity');
select has_table('public','outbox_events','partner effects use a transactional outbox');
select has_table('public','outbox_delivery_attempts','delivery attempts are retained');
select has_view('public','operational_crm_leads','CRM view exposes redacted operational data');
select has_function('public','apply_crm_disposition',array['jsonb'],'disposition command is transaction-backed');
select has_function('public','approve_partner_transfer',array['jsonb'],'transfer approval command exists');
select has_function('public','replay_partner_outbox',array['jsonb'],'dead-letter replay command exists');

select lives_ok($$
  select public.qualify_crm_lead(jsonb_build_object(
    'actor_id',(select id from public.app_users where role='operator' and active limit 1),
    'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
    'reason','Synthetic eligibility review','correlation_id','wi005-sql-qualify'
  ))
$$,'eligible synthetic lead can be explicitly prequalified');

select throws_ok($$
  select public.apply_crm_disposition(jsonb_build_object(
    'actor_id',(select id from public.app_users where role='operator' and active limit 1),
    'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
    'disposition','Call Back','idempotency_key','wi005-callback-invalid-01','reason','Past callback',
    'callback_at',(now()-interval '1 minute')::text,'timezone','America/Bogota','correlation_id','wi005-sql-callback'
  ))
$$,'22023',null,'past callback fails before stage mutation');

select is((select commercial_stage::text from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
  'prequalified','rejected callback leaves commercial state unchanged');

select lives_ok($$
  select public.apply_crm_disposition(jsonb_build_object(
    'actor_id',(select id from public.app_users where role='operator' and active limit 1),
    'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
    'disposition','No Answer','idempotency_key','wi005-no-answer-0001','reason','No answer during fictional test',
    'correlation_id','wi005-sql-no-answer'
  ))
$$,'No Answer records disposition and creates a draft');

select is((select commercial_stage::text from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
  'contact_attempted','No Answer applies documented commercial stage');
select is((select count(*)::integer from public.crm_follow_up_drafts where disposition_key='wi005-no-answer-0001'),
  1,'No Answer creates one pending human-review draft');
select lives_ok($$select public.approve_crm_follow_up_draft(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'draft_id',(select id from public.crm_follow_up_drafts where disposition_key='wi005-no-answer-0001'),
  'content','Hola, podemos continuar cuando te convenga.',
  'content_checksum',encode(extensions.digest('Hola, podemos continuar cuando te convenga.','sha256'),'hex'),
  'reason','Reviewed synthetic follow-up','correlation_id','wi005-sql-draft-approval'
))$$,'approved follow-up stores its edited content and checksum');
select is((select status from public.crm_follow_up_drafts where disposition_key='wi005-no-answer-0001'),
  'approved','follow-up draft remains separately approved');
select lives_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
  'disposition','Info Sent','crm_follow_up_draft_id',(select id from public.crm_follow_up_drafts where disposition_key='wi005-no-answer-0001'),
  'idempotency_key','wi005-info-sent-0001','reason','Approved follow-up action recorded','correlation_id','wi005-sql-info-sent'
))$$,'Info Sent accepts only a lead-linked approved follow-up');
select is((select commercial_stage::text from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
  'info_sent','Info Sent applies its documented stage');

select lives_ok($$
  select public.qualify_crm_lead(jsonb_build_object(
    'actor_id',(select id from public.app_users where role='operator' and active limit 1),
    'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-018'),
    'reason','Synthetic missing-phone review','correlation_id','wi005-sql-missing-qualify'
  ))
$$,'second synthetic lead can be prequalified');

update public.leads set fictional_phone=null where business_id='LEAD-018';
select lives_ok($$
  select public.apply_crm_disposition(jsonb_build_object(
    'actor_id',(select id from public.app_users where role='operator' and active limit 1),
    'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-018'),
    'disposition','No Answer','idempotency_key','wi005-no-phone-0001','reason','No phone in fictional fixture',
    'correlation_id','wi005-sql-no-phone'
  ))
$$,'missing phone creates visible recovery without partial disposition');
select is((select count(*)::integer from public.crm_recovery_items recovery join public.crm_lead_states state on state.id=recovery.crm_lead_id join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-018' and recovery.reason_code='missing_phone' and recovery.status='open'),
  1,'missing phone creates one recovery task');

select lives_ok($$select public.qualify_crm_lead(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-019'),
  'reason','Synthetic callback fixture qualification','correlation_id','wi005-sql-callback-qualify'
))$$,'callback test lead can be explicitly qualified');
select lives_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-019'),
  'disposition','Call Back','idempotency_key','wi005-callback-valid-01','reason','Synthetic callback scheduled',
  'callback_at',(now()+interval '1 day')::text,'timezone','America/Bogota','correlation_id','wi005-sql-callback-valid'
))$$,'valid future callback records successfully');
select is((select commercial_stage::text from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-019'),
  'callback_scheduled','Call Back applies its documented commercial stage');
select is((select prior_stage::text||':'||resulting_stage::text from public.crm_disposition_events where idempotency_key='wi005-callback-valid-01'),
  'prequalified:callback_scheduled','Call Back records before/after audit evidence');

select lives_ok($$select public.qualify_crm_lead(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-020'),
  'reason','Synthetic close disposition test','correlation_id','wi005-sql-close-qualify'
))$$,'not-interested test lead can be explicitly qualified');
select lives_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-020'),
  'disposition','No le interesa','idempotency_key','wi005-not-interested-01','reason','Synthetic test close',
  'correlation_id','wi005-sql-close'
))$$,'No le interesa records without claiming opt-out when none was supplied');
select is((select commercial_stage::text from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-020'),
  'closed_not_interested','No le interesa applies its documented commercial stage');
select is((select opted_out_at is null from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-020'),
  true,'No le interesa does not invent explicit opt-out evidence');

select lives_ok($$
  select public.approve_partner_transfer(jsonb_build_object(
    'actor_id',(select id from public.app_users where role='operator' and active limit 1),
    'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
    'idempotency_key','wi005-transfer-approve-01','reason','Explicit synthetic test approval','correlation_id','wi005-sql-transfer'
  ))
$$,'explicit operator approval creates one pending transfer');
select lives_ok($$
  select public.approve_partner_transfer(jsonb_build_object(
    'actor_id',(select id from public.app_users where role='operator' and active limit 1),
    'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
    'idempotency_key','wi005-transfer-approve-01','reason','Explicit synthetic test approval','correlation_id','wi005-sql-transfer'
  ))
$$,'repeated approval returns original transfer');
select is((select count(*)::integer from public.partner_transfers),1,'replay does not create a second partner transfer');
select is((select count(*)::integer from public.outbox_events),1,'approved transfer creates exactly one outbox event');

select lives_ok($$select public.claim_partner_outbox((select id from public.outbox_events limit 1))$$,
  'pending transfer can be claimed for delivery');
select lives_ok($$select public.complete_partner_outbox(jsonb_build_object(
  'event_id',(select id from public.outbox_events limit 1),'attempt_number',1,'started_at',now()::text,
  'outcome','retryable_failure','error_category','partner_unavailable','safe_error','synthetic retry test'
))$$,'retryable partner failure is scheduled');
select is((select status::text from public.outbox_events limit 1),'retry_scheduled','retryable failure schedules bounded backoff');

update public.outbox_events set next_attempt_at=now()-interval '1 second';
select lives_ok($$select public.claim_partner_outbox((select id from public.outbox_events limit 1))$$,
  'scheduled retry becomes claimable');
select lives_ok($$select public.complete_partner_outbox(jsonb_build_object(
  'event_id',(select id from public.outbox_events limit 1),'attempt_number',2,'started_at',now()::text,
  'outcome','permanent_failure','error_category','partner_rejected','safe_error','synthetic permanent test'
))$$,'permanent partner failure reaches dead letter');
select is((select status::text from public.outbox_events limit 1),'dead_letter','permanent failure is visible in the dead-letter queue');

select lives_ok($$select public.replay_partner_outbox(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'event_id',(select id from public.outbox_events limit 1),'reason','Synthetic replay test','correlation_id','wi005-sql-replay'
))$$,'authorized operator can replay a dead-letter effect');
select is((select status::text from public.outbox_events limit 1),'pending','manual replay returns the same effect to pending');
select lives_ok($$select public.claim_partner_outbox((select id from public.outbox_events limit 1))$$,
  'replayed effect can be claimed');
select lives_ok($$select public.complete_partner_outbox(jsonb_build_object(
  'event_id',(select id from public.outbox_events limit 1),'attempt_number',1,'started_at',now()::text,
  'outcome','delivered','partner_request_id','CC-TEST-00001'
))$$,'successful replay records partner acceptance');
select is((select status::text from public.outbox_events limit 1),'delivered','successful effect is terminal');
select is((select commercial_stage::text from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
  'transferred','partner acceptance advances commercial stage');
select lives_ok($$select public.apply_crm_disposition(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'crm_lead_id',(select state.id from public.crm_lead_states state join public.leads lead on lead.id=state.baseline_lead_id where lead.business_id='LEAD-017'),
  'disposition','Transferido','idempotency_key','wi005-transferred-disposition-01','reason','Accepted synthetic partner transfer',
  'correlation_id','wi005-sql-transferred-disposition'
))$$,'Transferido is accepted only after partner acceptance');
select is((select prior_stage::text||':'||resulting_stage::text from public.crm_disposition_events where idempotency_key='wi005-transferred-disposition-01'),
  'transferred:transferred','Transferido records before/after audit evidence');
select is((select count(*)::integer from public.outbox_delivery_attempts),3,'each transport attempt is retained');
select throws_ok($$select public.replay_partner_outbox(jsonb_build_object(
  'actor_id',(select id from public.app_users where role='operator' and active limit 1),
  'event_id',(select id from public.outbox_events limit 1),'reason','Do not replay success','correlation_id','wi005-sql-no-success-replay'
))$$,'22023',null,'successful effect cannot be replayed');

select * from finish();
rollback;
