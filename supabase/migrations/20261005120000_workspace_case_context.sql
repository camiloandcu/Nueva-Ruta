create or replace view public.operational_crm_leads as
select state.id, state.business_id,
  coalesce(lead.fictional_phone, event.fictional_phone) as fictional_phone,
  coalesce(lead.received_at, event.inbound_at) as received_at,
  coalesce(lead.initial_status::text, decision.decision::text, 'received') as initial_status,
  state.commercial_stage::text as commercial_stage, state.baseline_lead_id, state.source_event_id,
  redacted.redacted_body, redacted.redaction_types,
  (consent.status = 'withdrawn' or event.consent_context->>'status' = 'withdrawn'
    or state.opted_out_at is not null) as opted_out,
  state.updated_at,
  coalesce(consent.status::text,event.consent_context->>'status','unknown') as consent_status,
  coalesce(lead.channel::text,event.channel::text) as source_channel
from public.crm_lead_states state
left join public.leads lead on lead.id=state.baseline_lead_id
left join public.source_events event on event.id=state.source_event_id
left join public.processing_decisions decision on decision.source_event_id=event.id
left join public.redacted_event_evidence redacted on redacted.source_event_id=event.id
left join public.consent_evidence consent on consent.lead_id=lead.id;

create or replace view public.operational_escalations as
select escalation.*, (escalation.status <> 'resolved' and escalation.due_at < now()) as sla_breached,
  coalesce(state.id::text, escalation.decision_id::text) as operational_lead_id,
  state.id as crm_lead_id, state.business_id
from public.escalations escalation
left join public.processing_decisions decision on decision.id=escalation.decision_id
left join public.crm_lead_states state on state.source_event_id=decision.source_event_id;

create view public.operational_crm_recovery as
select recovery.*, state.business_id
from public.crm_recovery_items recovery
join public.crm_lead_states state on state.id=recovery.crm_lead_id;

create view public.operational_crm_follow_up_drafts as
select draft.*, state.business_id
from public.crm_follow_up_drafts draft
join public.crm_lead_states state on state.id=draft.crm_lead_id;

create view public.operational_partner_deliveries as
select event.*, transfer.crm_lead_id, state.business_id
from public.outbox_events event
join public.partner_transfers transfer on transfer.id=event.transfer_id
join public.crm_lead_states state on state.id=transfer.crm_lead_id;

create view public.operational_partner_delivery_attempts as
select attempt.*, transfer.crm_lead_id, state.business_id
from public.outbox_delivery_attempts attempt
join public.outbox_events event on event.id=attempt.outbox_event_id
join public.partner_transfers transfer on transfer.id=event.transfer_id
join public.crm_lead_states state on state.id=transfer.crm_lead_id;

revoke all on public.operational_crm_recovery,public.operational_crm_follow_up_drafts,
  public.operational_partner_deliveries,public.operational_partner_delivery_attempts
  from public,anon,authenticated;
grant select on public.operational_crm_recovery,public.operational_crm_follow_up_drafts,
  public.operational_partner_deliveries,public.operational_partner_delivery_attempts to service_role;
