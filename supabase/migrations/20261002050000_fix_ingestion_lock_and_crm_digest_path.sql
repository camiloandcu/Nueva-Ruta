-- Keep the WI-004 event lock expression unambiguous and resolve pgcrypto under
-- Supabase's extensions schema in both the ingestion and CRM draft functions.
create or replace function public.ingest_source_event(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,private,extensions,pg_temp as $$
declare
  event_data jsonb := p_payload->'event';
  result_data jsonb := p_payload->'result';
  existing jsonb;
  event_uuid uuid := (result_data->>'lead_id')::uuid;
  active_rule uuid;
  draft_body text := p_payload->>'draft_body';
  escalation_data jsonb := p_payload->'escalation';
begin
  perform pg_advisory_xact_lock(hashtextextended(
    (event_data->>'channel')||':'||(event_data->>'source_event_id'),404
  ));
  select result into existing from public.source_events
    where channel=(event_data->>'channel')::public.lead_channel
      and source_event_id=event_data->>'source_event_id';
  if existing is not null then return jsonb_set(existing,'{replayed}','true'::jsonb); end if;
  select id into active_rule from public.rule_versions where active;
  if active_rule is null then raise exception 'active rule version required' using errcode='23514'; end if;
  insert into public.source_events(id,channel,source_event_id,inbound_at,source_detail,fictional_phone,consent_context,correlation_id)
  values(event_uuid,(event_data->>'channel')::public.lead_channel,event_data->>'source_event_id',
    (event_data->>'inbound_at')::timestamptz,event_data->>'source_detail',event_data->>'fictional_phone',
    event_data->'consent',event_data->>'correlation_id');
  insert into private.restricted_event_evidence
  values(event_uuid,p_payload->>'restricted_body',
    encode(extensions.digest(p_payload->>'restricted_body','sha256'),'hex'),now());
  insert into public.redacted_event_evidence(source_event_id,redacted_body,redaction_types)
  values(event_uuid,p_payload->>'redacted_body',
    array(select jsonb_array_elements_text(p_payload->'redaction_types')));
  insert into public.processing_decisions(id,source_event_id,rule_version_id,decision,reason_code,safe_explanation,decision_source)
  values((result_data->>'decision_id')::uuid,event_uuid,active_rule,
    (result_data->>'decision')::public.processing_decision,result_data->>'reason_code',
    p_payload->>'explanation',result_data->>'decision_source');
  insert into public.extracted_lead_fields(decision_id,approved_fields,source,confidence)
  values((result_data->>'decision_id')::uuid,result_data->'extracted_fields',
    case when result_data->>'decision_source'='ai_assisted' then 'ai_assisted' else 'deterministic' end,null);
  insert into public.ai_attempts(decision_id,correlation_id,status,failure_layer,normalized_reason,provider,model,prompt_version,safe_metadata)
  values((result_data->>'decision_id')::uuid,result_data->>'correlation_id',result_data->>'ai_attempt_status',
    result_data->>'failure_layer',result_data->>'normalized_reason',p_payload->'attempt'->>'provider',
    p_payload->'attempt'->>'model',p_payload->'attempt'->>'prompt_version',p_payload->'attempt'->'safe_metadata');
  if result_data->>'draft_id' is not null then
    insert into public.response_drafts(id,decision_id,content,content_checksum,rule_version_id,model)
    values((result_data->>'draft_id')::uuid,(result_data->>'decision_id')::uuid,draft_body,
      encode(extensions.digest(draft_body,'sha256'),'hex'),active_rule,nullif(p_payload->'attempt'->>'model',''));
  end if;
  if result_data->>'escalation_id' is not null then
    insert into public.escalations(id,decision_id,reason_code,priority,redacted_summary,due_at,suggested_role)
    values((result_data->>'escalation_id')::uuid,(result_data->>'decision_id')::uuid,result_data->>'reason_code',
      escalation_data->>'priority',left(p_payload->>'redacted_body',500),
      (escalation_data->>'due_at')::timestamptz,(escalation_data->>'suggested_role')::public.app_role);
  end if;
  update public.source_events set result=result_data where id=event_uuid;
  return result_data;
end; $$;

alter function public.apply_crm_disposition(jsonb) set search_path=public,extensions,pg_temp;
