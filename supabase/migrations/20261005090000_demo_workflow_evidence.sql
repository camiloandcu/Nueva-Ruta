-- Keep the review and assistance surfaces useful immediately after a reset.
-- Every displayed example is backed by the same domain tables as a live inbound event.
create function private.seed_demo_workflow_evidence() returns void
language plpgsql security definer set search_path=public,private,extensions,pg_temp as $$
declare
  active_rule uuid;
  example record;
  event_id uuid;
  decision_id uuid;
  draft_id uuid;
  escalation_id uuid;
  result_data jsonb;
begin
  select id into active_rule from public.rule_versions where active;
  if active_rule is null then raise exception 'active rule version required' using errcode='23514'; end if;

  for example in
    select * from (values
      ('consulta-completa','ctwa','Anuncio de creador','+15550180',
       'Tengo aproximadamente $12,000 en tarjetas y vivo en TX. ¿Puedo hablar con un consejero?',
       'respond','safe_inquiry',
       'Gracias por la información. Un consejero podría orientarte según tu situación.',null::text),
      ('consulta-incompleta','organic','Búsqueda directa','+15550181',
       'Necesito orientación sobre mis tarjetas, ¿qué datos necesitan?',
       'respond','safe_inquiry',
       'Gracias por escribir. Para orientarte, ¿podrías compartir un monto aproximado, el tipo general de deuda y tu estado? No envíes números de cuenta ni credenciales.',null::text),
      ('revision-legal','organic','Consulta directa','+15550182',
       'Recibí una demanda y quiero hablar con una persona antes de continuar.',
       'escalate_human','legal_or_risk',null::text,'urgent')
    ) as cases(slug,channel,source_detail,phone,body,decision,reason,draft,priority)
  loop
    if exists (select 1 from public.source_events where source_event_id='example-'||example.slug) then
      continue;
    end if;
    event_id:=private.fixture_uuid('demo-event-'||example.slug);
    decision_id:=private.fixture_uuid('demo-decision-'||example.slug);
    draft_id:=case when example.draft is not null then private.fixture_uuid('demo-draft-'||example.slug) else null end;
    escalation_id:=case when example.priority is not null then private.fixture_uuid('demo-escalation-'||example.slug) else null end;
    result_data:=jsonb_build_object(
      'lead_id',event_id,'message_id',private.fixture_uuid('demo-message-'||example.slug),
      'decision_id',decision_id,'correlation_id','example-'||example.slug,
      'decision',example.decision,'reason_code',example.reason,'decision_source','deterministic',
      'ai_attempt_status','skipped_configuration','failure_layer','configuration',
      'normalized_reason','provider_disabled','redacted_message',example.body,
      'redaction_types','[]'::jsonb,'extracted_fields','{}'::jsonb,
      'draft_id',draft_id,'escalation_id',escalation_id,'automatic_effect_id',null,'replayed',false);
    insert into public.source_events(id,channel,source_event_id,inbound_at,source_detail,
      fictional_phone,consent_context,correlation_id,creator_id,result)
    values(event_id,example.channel::public.lead_channel,'example-'||example.slug,
      now()-interval '12 minutes',example.source_detail,example.phone,
      '{"status":"granted","source":"inbound","conversation_window_open":true}'::jsonb,
      'example-'||example.slug,
      case when example.channel='ctwa' then (select id from public.creators where business_id='CR-001') else null end,
      result_data);
    insert into private.restricted_event_evidence(source_event_id,original_body,body_sha256)
    values(event_id,example.body,encode(digest(example.body,'sha256'),'hex'));
    insert into public.redacted_event_evidence(source_event_id,redacted_body,redaction_types)
    values(event_id,example.body,'{}');
    insert into public.processing_decisions(id,source_event_id,rule_version_id,decision,
      reason_code,safe_explanation,decision_source)
    values(decision_id,event_id,active_rule,example.decision::public.processing_decision,
      example.reason,'Classified by current deterministic rules.','deterministic');
    insert into public.extracted_lead_fields(decision_id,approved_fields,source)
    values(decision_id,'{}','deterministic');
    insert into public.ai_attempts(decision_id,correlation_id,status,failure_layer,
      normalized_reason,provider,model,prompt_version)
    values(decision_id,'example-'||example.slug,'skipped_configuration','configuration',
      'provider_disabled','deterministic','','wi004-v1');
    if draft_id is not null then
      insert into public.response_drafts(id,decision_id,content,content_checksum,rule_version_id)
      values(draft_id,decision_id,example.draft,encode(digest(example.draft,'sha256'),'hex'),active_rule);
    end if;
    if escalation_id is not null then
      insert into public.escalations(id,decision_id,reason_code,priority,
        redacted_summary,due_at,suggested_role)
      values(escalation_id,decision_id,example.reason,example.priority,
        example.body,now()+interval '1 hour','supervisor');
    end if;
  end loop;
end; $$;

create view public.operational_assistance_attempts as
select attempt.id,attempt.decision_id,attempt.correlation_id,attempt.status,
  attempt.failure_layer,attempt.normalized_reason,attempt.provider,attempt.model,
  attempt.created_at,decision.decision,decision.reason_code,
  event.id as lead_id,event.source_event_id,event.inbound_at
from public.ai_attempts attempt
join public.processing_decisions decision on decision.id=attempt.decision_id
join public.source_events event on event.id=decision.source_event_id;

revoke all on public.operational_assistance_attempts from public,anon,authenticated;
grant select on public.operational_assistance_attempts to service_role;
revoke all on function private.seed_demo_workflow_evidence() from public,anon,authenticated;

alter function public.reset_synthetic_baseline(uuid,text,text,text)
  rename to reset_synthetic_baseline_before_demo_evidence;
create function public.reset_synthetic_baseline(
  p_actor_id uuid,p_confirmation text,p_reason text,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare counts jsonb;
begin
  counts:=public.reset_synthetic_baseline_before_demo_evidence(
    p_actor_id,p_confirmation,p_reason,p_correlation_id);
  perform private.seed_demo_workflow_evidence();
  return counts||jsonb_build_object(
    'source_events',(select count(*) from public.source_events),
    'decisions',(select count(*) from public.processing_decisions),
    'drafts',(select count(*) from public.response_drafts),
    'escalations',(select count(*) from public.escalations),
    'ai_attempts',(select count(*) from public.ai_attempts),
    'crm_leads',(select count(*) from public.crm_lead_states));
end; $$;

revoke all on function public.reset_synthetic_baseline(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.reset_synthetic_baseline(uuid,text,text,text) to service_role;

-- Fresh local migrations run before seed.sql creates CR-001.
-- Existing populated demos still receive the examples on upgrade.
do $$ begin
  if exists (select 1 from public.creators where business_id = 'CR-001') then
    perform private.seed_demo_workflow_evidence();
  end if;
end $$;
