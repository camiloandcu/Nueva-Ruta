-- WI-007: preserve original CTWA attribution and add a role-checked reporting fact snapshot.
alter table public.source_events
  add column creator_id uuid references public.creators(id) on delete restrict;
alter table public.source_events
  add constraint source_event_creator_matches_channel
  check ((channel = 'organic' and creator_id is null) or (channel = 'ctwa' and creator_id is not null))
  not valid;

create or replace function public.ingest_source_event(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, private, extensions, pg_temp as $$
declare
  event_data jsonb := p_payload->'event';
  result_data jsonb := p_payload->'result';
  existing jsonb;
  event_uuid uuid := (result_data->>'lead_id')::uuid;
  active_rule uuid;
  draft_body text := p_payload->>'draft_body';
  escalation_data jsonb := p_payload->'escalation';
  source_creator uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended((event_data->>'channel')||':'||(event_data->>'source_event_id'), 404));
  select result into existing from public.source_events
    where channel = (event_data->>'channel')::public.lead_channel and source_event_id = event_data->>'source_event_id';
  if existing is not null then return jsonb_set(existing, '{replayed}', 'true'::jsonb); end if;
  if event_data->>'channel' = 'ctwa' then
    select id into source_creator from public.creators where business_id = event_data->>'creator_business_id';
    if source_creator is null then raise exception 'known CTWA creator attribution required' using errcode='22023'; end if;
  elsif nullif(event_data->>'creator_business_id','') is not null then
    raise exception 'organic event cannot claim creator attribution' using errcode='22023';
  end if;
  select id into active_rule from public.rule_versions where active;
  if active_rule is null then raise exception 'active rule version required' using errcode = '23514'; end if;
  insert into public.source_events(id,channel,source_event_id,inbound_at,source_detail,fictional_phone,consent_context,correlation_id,creator_id)
  values(event_uuid,(event_data->>'channel')::public.lead_channel,event_data->>'source_event_id',(event_data->>'inbound_at')::timestamptz,
    event_data->>'source_detail',event_data->>'fictional_phone',event_data->'consent',event_data->>'correlation_id',source_creator);
  insert into private.restricted_event_evidence values(event_uuid,p_payload->>'restricted_body',encode(digest(p_payload->>'restricted_body','sha256'),'hex'),now());
  insert into public.redacted_event_evidence(source_event_id,redacted_body,redaction_types)
  values(event_uuid,p_payload->>'redacted_body',array(select jsonb_array_elements_text(p_payload->'redaction_types')));
  insert into public.processing_decisions(id,source_event_id,rule_version_id,decision,reason_code,safe_explanation,decision_source)
  values((result_data->>'decision_id')::uuid,event_uuid,active_rule,(result_data->>'decision')::public.processing_decision,
    result_data->>'reason_code',p_payload->>'explanation',result_data->>'decision_source');
  insert into public.extracted_lead_fields(decision_id,approved_fields,source,confidence)
  values((result_data->>'decision_id')::uuid,result_data->'extracted_fields',
    case when result_data->>'decision_source'='ai_assisted' then 'ai_assisted' else 'deterministic' end,null);
  insert into public.ai_attempts(decision_id,correlation_id,status,failure_layer,normalized_reason,provider,model,prompt_version,safe_metadata)
  values((result_data->>'decision_id')::uuid,result_data->>'correlation_id',result_data->>'ai_attempt_status',result_data->>'failure_layer',
    result_data->>'normalized_reason',p_payload->'attempt'->>'provider',p_payload->'attempt'->>'model',p_payload->'attempt'->>'prompt_version',p_payload->'attempt'->'safe_metadata');
  if result_data->>'draft_id' is not null then
    insert into public.response_drafts(id,decision_id,content,content_checksum,rule_version_id,model)
    values((result_data->>'draft_id')::uuid,(result_data->>'decision_id')::uuid,draft_body,encode(digest(draft_body,'sha256'),'hex'),active_rule,nullif(p_payload->'attempt'->>'model',''));
  end if;
  if result_data->>'escalation_id' is not null then
    insert into public.escalations(id,decision_id,reason_code,priority,redacted_summary,due_at,suggested_role)
    values((result_data->>'escalation_id')::uuid,(result_data->>'decision_id')::uuid,result_data->>'reason_code',escalation_data->>'priority',
      left(p_payload->>'redacted_body',500),(escalation_data->>'due_at')::timestamptz,(escalation_data->>'suggested_role')::public.app_role);
  end if;
  update public.source_events set result = result_data where id=event_uuid;
  return result_data;
end; $$;

-- Rule content v1 remains immutable. Version 2 adds the already-approved stalled-work defaults.
do $$
declare prior public.rule_versions%rowtype; next_content jsonb;
begin
  select * into prior from public.rule_versions where active for update;
  if not found then raise exception 'active rule version required'; end if;
  if prior.content ? 'stalled_work' then return; end if;
  next_content := jsonb_set(prior.content, '{schema_version}', '2'::jsonb, true);
  next_content := jsonb_set(next_content, '{stalled_work}',
    '{"approaching_ratio":0.8,"callback_approaching_minutes":15,"new_unclassified_minutes":15,"human_review_pending_business_hours":4,"prequalified_without_disposition_business_hours":8,"info_sent_without_activity_hours":24,"transferred_without_partner_confirmation_hours":48,"reconciliation_conflict_unresolved_business_days":2}'::jsonb, true);
  perform set_config('app.rule_publication', 'on', true);
  update public.rule_versions set active=false where id=prior.id;
  insert into public.rule_versions(id,version,schema_version,content,content_hash,parent_version_id,derived_from_version_id,published_by,published_at,active)
  values(private.fixture_uuid('rule-version-2'), prior.version+1, 2, next_content,
    '5a3356441b5ae2e3a3b43a718bfa5776605af2f5ef5aa6246b5ff887cbf61316', prior.id, prior.id,
    prior.published_by, '2026-10-03 00:00:00+00', true);
end; $$;

create or replace function public.operational_reporting_facts(p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare facts jsonb;
begin
  if not exists(select 1 from public.app_users where id=p_actor_id and active and role in ('operator','supervisor','analyst')) then
    raise exception 'active reporting role required' using errcode='42501';
  end if;
  select jsonb_build_object(
    'active_rule', (select jsonb_build_object('id',id,'version',version,'content',content) from public.rule_versions where active),
    'rule_versions', coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'content',content)) from public.rule_versions),'[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'crm_lead_id',state.id,'baseline_lead_id',lead.id,'source_event_id',event.id,
        'business_id',coalesce(lead.business_id,'EVENT-'||event.source_event_id),
        'received_at',coalesce(lead.received_at,event.inbound_at),
        'channel',coalesce(lead.channel::text,event.channel::text),
        'creator_business_id',coalesce(lead_creator.business_id,event_creator.business_id),
        'state',(select approved.approved_fields->>'state' from public.processing_decisions latest
          join public.extracted_lead_fields approved on approved.decision_id=latest.id
          where latest.source_event_id=event.id order by latest.created_at desc limit 1),
        'initial_status',coalesce(lead.initial_status::text,(select latest.decision::text from public.processing_decisions latest
          where latest.source_event_id=event.id order by latest.created_at desc limit 1),'received'),
        'commercial_stage',state.commercial_stage::text,'stage_updated_at',state.updated_at,
        'qualified_at',state.qualified_at,'crm_state_created_at',state.created_at,'opted_out_at',state.opted_out_at,
        'callback_at',(select action.callback_at from public.crm_disposition_events action
          where action.crm_lead_id=state.id and action.resulting_stage='callback_scheduled' order by action.occurred_at desc limit 1),
        'last_disposition_at',(select max(action.occurred_at) from public.crm_disposition_events action where action.crm_lead_id=state.id)
      ) order by coalesce(lead.received_at,event.inbound_at))
      from public.crm_lead_states state
      left join public.leads lead on lead.id=state.baseline_lead_id
      left join public.creators lead_creator on lead_creator.id=lead.creator_id
      left join public.source_events event on event.id=state.source_event_id
      left join public.creators event_creator on event_creator.id=event.creator_id
    ),'[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(jsonb_build_object('lead_id',state.id,'decision',decision.decision::text,
      'reason_code',decision.reason_code,'created_at',decision.created_at,'rule_version_id',decision.rule_version_id))
      from public.processing_decisions decision join public.crm_lead_states state on state.source_event_id=decision.source_event_id),'[]'::jsonb),
    'drafts', coalesce((select jsonb_agg(jsonb_build_object('id',draft.id,'lead_id',state.id,'status',draft.status::text,
      'created_at',draft.created_at,'rule_version_id',draft.rule_version_id)) from public.response_drafts draft
      join public.processing_decisions decision on decision.id=draft.decision_id
      join public.crm_lead_states state on state.source_event_id=decision.source_event_id),'[]'::jsonb),
    'follow_up_drafts', coalesce((select jsonb_agg(jsonb_build_object('id',draft.id,'lead_id',draft.crm_lead_id,
      'status',draft.status,'created_at',draft.created_at,'rule_version_id',draft.rule_version_id))
      from public.crm_follow_up_drafts draft),'[]'::jsonb),
    'escalations', coalesce((select jsonb_agg(jsonb_build_object('id',escalation.id,'lead_id',state.id,
      'lifecycle_state',escalation.lifecycle_state,'status',escalation.status::text,'created_at',escalation.created_at,
      'due_at',escalation.due_at,'owner_id',escalation.owner_id,'owner_role',escalation.suggested_role::text,
      'claimed_at',escalation.claimed_at,'resolved_at',escalation.resolved_at,'reason_code',escalation.reason_code,
      'rule_version_id',decision.rule_version_id)) from public.escalations escalation
      join public.processing_decisions decision on decision.id=escalation.decision_id
      left join public.crm_lead_states state on state.source_event_id=decision.source_event_id),'[]'::jsonb),
    'dispositions', coalesce((select jsonb_agg(jsonb_build_object('lead_id',action.crm_lead_id,'occurred_at',action.occurred_at,
      'prior_stage',action.prior_stage::text,'resulting_stage',action.resulting_stage::text,'disposition',action.disposition::text))
      from public.crm_disposition_events action),'[]'::jsonb),
    'transfers', coalesce((select jsonb_agg(jsonb_build_object('id',transfer.id,'lead_id',transfer.crm_lead_id,'status',transfer.status::text,
      'approved_at',transfer.approved_at,'partner_request_id',transfer.partner_request_id)) from public.partner_transfers transfer),'[]'::jsonb),
    'outbox', coalesce((select jsonb_agg(jsonb_build_object('id',event.id,'transfer_id',event.transfer_id,'status',event.status::text,
      'created_at',event.created_at,'updated_at',event.updated_at,'attempt_count',event.attempt_count,'next_attempt_at',event.next_attempt_at))
      from public.outbox_events event),'[]'::jsonb),
    'delivery_attempts', coalesce((select jsonb_agg(jsonb_build_object('outbox_event_id',attempt.outbox_event_id,
      'outcome',attempt.outcome,'started_at',attempt.started_at,'completed_at',attempt.completed_at))
      from public.outbox_delivery_attempts attempt),'[]'::jsonb),
    'imports', coalesce((select jsonb_agg(jsonb_build_object('id',job.id,'imported_at',job.imported_at))
      from public.partner_import_jobs job where job.synthetic),'[]'::jsonb),
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object('id',canonical.id,'import_job_id',canonical.import_job_id,
      'partner_enrollment_id',canonical.partner_enrollment_id,'source_row_numbers',canonical.source_row_numbers,
      'quality_issues',canonical.quality_issues,'conflicted',canonical.conflicted)) from public.partner_canonical_enrollments canonical),'[]'::jsonb),
    'reconciliations', coalesce((select jsonb_agg(jsonb_build_object('id',case_row.id,'canonical_enrollment_id',case_row.canonical_enrollment_id,
      'status',case_row.status,'match_method',case_row.match_method,'lead_id',case_row.lead_id,'candidate_lead_ids',case_row.candidate_lead_ids,
      'conflict_flags',case_row.conflict_flags,'potentially_commissionable',case_row.potentially_commissionable,
      'updated_at',case_row.updated_at,'evidence',case_row.evidence)) from public.partner_reconciliation_cases case_row),'[]'::jsonb),
    'normalized_quality', coalesce((select jsonb_agg(jsonb_build_object('import_job_id',raw.import_job_id,'quality_issues',normalized.quality_issues))
      from public.partner_normalized_rows normalized join public.raw_partner_rows raw on raw.id=normalized.raw_row_id),'[]'::jsonb)
  ) into facts;
  return facts;
end; $$;

create or replace function public.operational_reporting_enrollment_evidence(p_actor_id uuid,p_canonical_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare evidence jsonb;
begin
  if not exists(select 1 from public.app_users where id=p_actor_id and active and role in ('operator','supervisor','analyst')) then
    raise exception 'active reporting role required' using errcode='42501';
  end if;
  select jsonb_build_object('canonical_enrollment_id',canonical.id,'partner_enrollment_id',canonical.partner_enrollment_id,
    'source_row_numbers',canonical.source_row_numbers,'quality_issues',canonical.quality_issues,'conflicted',canonical.conflicted,
    'reconciliation',jsonb_build_object('id',case_row.id,'status',case_row.status,'match_method',case_row.match_method,
      'lead_id',case_row.lead_id,'conflict_flags',case_row.conflict_flags,'potentially_commissionable',case_row.potentially_commissionable,
      'evidence',case_row.evidence),
    'source_rows',(select coalesce(jsonb_agg(jsonb_build_object('row_number',raw.row_number,'row_checksum',raw.row_checksum,
      'import_job_id',raw.import_job_id)), '[]'::jsonb) from public.raw_partner_rows raw
      where raw.import_job_id=canonical.import_job_id and raw.row_number=any(canonical.source_row_numbers)),
    'lead', (select jsonb_build_object('id',lead.id,'business_id',lead.business_id,'creator_business_id',creator.business_id,
      'channel',lead.channel::text,'received_at',lead.received_at,'commercial_stage',state.commercial_stage::text)
      from public.leads lead join public.crm_lead_states state on state.baseline_lead_id=lead.id
      left join public.creators creator on creator.id=lead.creator_id where lead.id=case_row.lead_id)
  ) into evidence
  from public.partner_canonical_enrollments canonical
  left join public.partner_reconciliation_cases case_row on case_row.canonical_enrollment_id=canonical.id
  where canonical.id=p_canonical_id;
  if evidence is null then raise exception 'reported enrollment not found' using errcode='P0002'; end if;
  return evidence;
end; $$;

alter function public.reset_synthetic_baseline(uuid,text,text,text) rename to reset_synthetic_baseline_wi006;
create function public.reset_synthetic_baseline(p_actor_id uuid,p_confirmation text,p_reason text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare counts jsonb; active_rule uuid; ref constant timestamptz := '2026-09-15 17:00:00+00';
begin
  counts:=public.reset_synthetic_baseline_wi006(p_actor_id,p_confirmation,p_reason,p_correlation_id);
  select id into active_rule from public.rule_versions where active;
  -- Deterministic current-stage timestamps are relative to the declared fixture reference instant.
  update public.crm_lead_states state set updated_at=case lead.business_id
    when 'LEAD-017' then '2026-09-15 15:00:00+00'::timestamptz
    when 'LEAD-018' then '2026-09-14 19:00:00+00'::timestamptz
    when 'LEAD-019' then '2026-09-14 13:00:00+00'::timestamptz
    when 'LEAD-020' then '2026-09-15 16:00:00+00'::timestamptz
    when 'LEAD-021' then '2026-09-15 13:30:00+00'::timestamptz
    when 'LEAD-022' then '2026-09-14 21:00:00+00'::timestamptz
    when 'LEAD-026' then ref-interval '14 hours'
    when 'LEAD-027' then ref-interval '21 hours'
    when 'LEAD-028' then ref-interval '25 hours'
    else state.updated_at end,
    qualified_at=case lead.business_id
      when 'LEAD-017' then '2026-09-15 15:00:00+00'::timestamptz
      when 'LEAD-018' then '2026-09-14 19:00:00+00'::timestamptz
      when 'LEAD-019' then '2026-09-14 13:00:00+00'::timestamptz
      else state.qualified_at end
  from public.leads lead where lead.id=state.baseline_lead_id;
  update public.crm_lead_states state set commercial_stage='prequalified',qualified_by=p_actor_id,
    qualified_at='2026-09-12 17:00:00+00'::timestamptz,updated_at='2026-09-12 17:00:00+00'::timestamptz
  from public.leads lead where lead.id=state.baseline_lead_id and lead.business_id in ('LEAD-023','LEAD-024','LEAD-025');
  update public.crm_lead_states state set commercial_stage='callback_scheduled',updated_at=ref-interval '1 day'
  from public.leads lead where lead.id=state.baseline_lead_id and lead.business_id in ('LEAD-023','LEAD-024','LEAD-025');
  insert into public.crm_disposition_events(crm_lead_id,idempotency_key,disposition,actor_id,occurred_at,prior_stage,resulting_stage,
    reason,callback_at,timezone,rule_version_id,side_effect_status,correlation_id)
  select state.id,'wi007-callback-'||lead.business_id,'Call Back',p_actor_id,ref-interval '1 day','prequalified','callback_scheduled',
    'Synthetic reporting fixture only',case lead.business_id when 'LEAD-023' then ref+interval '2 hours'
      when 'LEAD-024' then ref+interval '10 minutes' else ref-interval '1 minute' end,'America/New_York',active_rule,'none',
    'wi007-reporting-reset'
  from public.leads lead join public.crm_lead_states state on state.baseline_lead_id=lead.id
  where lead.business_id in ('LEAD-023','LEAD-024','LEAD-025');
  update public.crm_lead_states state set commercial_stage='info_sent',qualified_by=p_actor_id,
    qualified_at=ref-interval '2 days',updated_at=ref-interval '14 hours'
  from public.leads lead where lead.id=state.baseline_lead_id and lead.business_id='LEAD-026';
  update public.crm_lead_states state set commercial_stage='info_sent',qualified_by=p_actor_id,
    qualified_at=ref-interval '2 days',updated_at=case lead.business_id when 'LEAD-027' then ref-interval '21 hours' else ref-interval '25 hours' end
  from public.leads lead where lead.id=state.baseline_lead_id and lead.business_id in ('LEAD-027','LEAD-028');
  insert into public.crm_disposition_events(crm_lead_id,idempotency_key,disposition,actor_id,occurred_at,prior_stage,resulting_stage,
    reason,rule_version_id,side_effect_status,external_action_reference,correlation_id)
  select state.id,'wi007-info-sent-'||lead.business_id,'Info Sent',p_actor_id,state.updated_at,'prequalified','info_sent',
    'Synthetic reporting fixture only',active_rule,'manual_action_recorded','synthetic-reporting-fixture','wi007-reporting-reset'
  from public.leads lead join public.crm_lead_states state on state.baseline_lead_id=lead.id
  where lead.business_id in ('LEAD-026','LEAD-027','LEAD-028');
  update public.partner_reconciliation_cases case_row set updated_at=case seq.n
    when 1 then '2026-09-15 17:00:00+00'::timestamptz
    when 2 then '2026-09-11 17:30:00+00'::timestamptz
    else '2026-09-11 17:00:00+00'::timestamptz end
  from (select id,row_number() over(order by id) n from public.partner_reconciliation_cases where status='review_required') seq
  where seq.id=case_row.id and seq.n<=3;
  counts:=counts||jsonb_build_object('crm_disposition_events',(select count(*) from public.crm_disposition_events),
    'reporting_canonical_enrollments',(select count(*) from public.partner_canonical_enrollments),
    'reporting_reconciliation_cases',(select count(*) from public.partner_reconciliation_cases),
    'reporting_rule_version',(select version from public.rule_versions where id=active_rule));
  return counts;
end; $$;

revoke all on function public.operational_reporting_facts(uuid) from public,anon,authenticated;
revoke all on function public.operational_reporting_enrollment_evidence(uuid,uuid) from public,anon,authenticated;
grant execute on function public.operational_reporting_facts(uuid) to service_role;
grant execute on function public.operational_reporting_enrollment_evidence(uuid,uuid) to service_role;
revoke all on function public.reset_synthetic_baseline(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reset_synthetic_baseline(uuid,text,text,text) to service_role;
