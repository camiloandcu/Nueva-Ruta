alter table public.extracted_lead_fields
  add column corrected_at timestamptz,
  add column corrected_by uuid references public.app_users(id) on delete restrict;

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
  coalesce(lead.channel::text,event.channel::text) as source_channel,
  extracted.approved_fields as extracted_fields,
  extracted.source as extraction_source,
  extracted.corrected_at as extraction_corrected_at
from public.crm_lead_states state
left join public.leads lead on lead.id=state.baseline_lead_id
left join public.source_events event on event.id=state.source_event_id
left join public.processing_decisions decision on decision.source_event_id=event.id
left join public.redacted_event_evidence redacted on redacted.source_event_id=event.id
left join public.consent_evidence consent on consent.lead_id=lead.id
left join public.extracted_lead_fields extracted on extracted.decision_id=decision.id;

create function public.correct_extracted_lead_fields(
  p_crm_lead_id uuid, p_actor_id uuid, p_expected_fields jsonb,
  p_fields jsonb, p_reason text, p_correlation_id text
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  extraction_id uuid;
  previous_fields jsonb;
  extraction_source text;
  edited_at timestamptz;
  changed_keys jsonb;
begin
  if not exists (
    select 1 from public.app_users
    where id=p_actor_id and active and role in ('operator', 'supervisor')
  ) then
    raise exception 'operator or supervisor required' using errcode='42501';
  end if;
  if length(trim(p_reason)) < 3 or length(p_reason) > 300
    or length(trim(p_correlation_id)) < 1 or length(p_correlation_id) > 100 then
    raise exception 'reason and correlation required' using errcode='22023';
  end if;
  if jsonb_typeof(p_fields) <> 'object'
    or (select count(*) from jsonb_object_keys(p_fields)) <> 6
    or not (p_fields ?& array[
      'approximate_debt','debt_type','state','preferred_language',
      'preferred_contact_time','wants_counselor'
    ]) then
    raise exception 'invalid extraction fields' using errcode='22023';
  end if;

  select extracted.decision_id, extracted.approved_fields, extracted.source
    into extraction_id, previous_fields, extraction_source
  from public.crm_lead_states state
  join public.processing_decisions decision on decision.source_event_id=state.source_event_id
  join public.extracted_lead_fields extracted on extracted.decision_id=decision.id
  where state.id=p_crm_lead_id
  for update of extracted;
  if not found then
    raise exception 'case extraction not found' using errcode='P0002';
  end if;
  if previous_fields is distinct from p_expected_fields then
    raise exception 'extraction changed since review' using errcode='23505';
  end if;
  if previous_fields = p_fields then
    return jsonb_build_object('approved_fields', previous_fields,
      'source', extraction_source, 'corrected_at', null);
  end if;

  select coalesce(jsonb_agg(key), '[]'::jsonb) into changed_keys
  from jsonb_object_keys(p_fields) as key
  where previous_fields->key is distinct from p_fields->key;
  edited_at := now();
  update public.extracted_lead_fields
  set approved_fields=p_fields, corrected_at=edited_at, corrected_by=p_actor_id
  where decision_id=extraction_id;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(p_actor_id,'extracted_fields.corrected',p_correlation_id,p_reason,'succeeded',
    jsonb_build_object('crm_lead_id',p_crm_lead_id,'changed_fields',changed_keys));
  return jsonb_build_object('approved_fields',p_fields,
    'source',extraction_source,'corrected_at',edited_at);
end;
$$;

revoke all on function public.correct_extracted_lead_fields(uuid,uuid,jsonb,jsonb,text,text)
  from public, anon, authenticated;
grant execute on function public.correct_extracted_lead_fields(uuid,uuid,jsonb,jsonb,text,text)
  to service_role;
