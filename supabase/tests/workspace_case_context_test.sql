begin;
select plan(11);

select has_view('public','operational_crm_recovery','recovery items have a case read model');
select has_view('public','operational_crm_follow_up_drafts','follow-up work has a case read model');
select has_view('public','operational_partner_deliveries','partner deliveries have a case read model');
select has_view('public','operational_partner_delivery_attempts','delivery attempts have a case read model');
select is((select count(*)::integer from public.operational_crm_leads
  where consent_status is null or source_channel is null),0,
  'case header receives consent and source context');
select is((select count(*)::integer from public.operational_crm_leads view
  join public.crm_lead_states state on state.id=view.id
  where view.business_id=state.business_id),
  (select count(*)::integer from public.crm_lead_states),
  'case header retains the persistent business label');
select is((select count(*)::integer from public.operational_escalations view
  join public.crm_lead_states state on state.id=view.crm_lead_id
  where view.business_id=state.business_id),
  (select count(*)::integer from public.operational_escalations where crm_lead_id is not null),
  'linked global escalations identify their own CRM case');
select is((select count(*)::integer from public.operational_crm_recovery view
  join public.crm_lead_states state on state.id=view.crm_lead_id
  where view.business_id=state.business_id),
  (select count(*)::integer from public.crm_recovery_items),
  'global recovery items identify their own CRM case');

insert into public.crm_follow_up_drafts
  (crm_lead_id,disposition_key,content,content_checksum,created_by)
select state.id,'workspace-case-follow-up','Synthetic follow-up for workspace test',
  encode(extensions.digest('Synthetic follow-up for workspace test','sha256'),'hex'),
  (select id from public.app_users where role='operator' and active limit 1)
from public.crm_lead_states state where state.business_id='LEAD-017';
select is((select business_id from public.operational_crm_follow_up_drafts
  where disposition_key='workspace-case-follow-up'),'LEAD-017',
  'follow-up queue retains its own lead label');

insert into public.partner_transfers(crm_lead_id,approved_by,reason,idempotency_key)
select state.id,(select id from public.app_users where role='operator' and active limit 1),
  'Synthetic workspace test','workspace-case-transfer'
from public.crm_lead_states state where state.business_id='LEAD-017';
insert into public.outbox_events(event_type,transfer_id,idempotency_key)
select 'partner_transfer',id,'workspace-case-outbox' from public.partner_transfers
where idempotency_key='workspace-case-transfer';
insert into public.outbox_delivery_attempts
  (outbox_event_id,attempt_number,replay_generation,outcome,started_at)
select id,1,0,'retryable_failure',now() from public.outbox_events
where idempotency_key='workspace-case-outbox';
select is((select business_id from public.operational_partner_deliveries
  where idempotency_key='workspace-case-outbox'),'LEAD-017',
  'delivery queue links to its transfer case');
select is((select business_id from public.operational_partner_delivery_attempts
  where outbox_event_id=(select id from public.outbox_events where idempotency_key='workspace-case-outbox')),
  'LEAD-017','attempt history links to its transfer case');

select * from finish();
rollback;
