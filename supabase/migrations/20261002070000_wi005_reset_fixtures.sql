create or replace function private.reject_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.synthetic_reset', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create function private.seed_wi005_synthetic_fixtures(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  active_rule uuid;
  sla_event uuid := private.fixture_uuid('wi005-sla-event');
  sla_decision uuid := private.fixture_uuid('wi005-sla-decision');
  missing_phone_lead uuid;
begin
  insert into public.crm_lead_states(baseline_lead_id, commercial_stage)
  select lead.id,
    case lead.initial_status
      when 'needs_review' then 'under_review'::public.crm_commercial_stage
      when 'ignored' then 'closed_not_interested'::public.crm_commercial_stage
      else 'new'::public.crm_commercial_stage
    end
  from public.leads lead
  on conflict (baseline_lead_id) do nothing;

  update public.leads set fictional_phone = null where business_id = 'LEAD-018';
  update public.crm_lead_states state
  set commercial_stage = 'prequalified',
      qualified_by = p_actor_id,
      qualified_at = '2026-09-15 17:00:00+00',
      updated_at = '2026-09-15 17:00:00+00'
  from public.leads lead
  where lead.id = state.baseline_lead_id
    and lead.business_id in ('LEAD-017', 'LEAD-018', 'LEAD-019');

  select state.id into missing_phone_lead
  from public.crm_lead_states state
  join public.leads lead on lead.id = state.baseline_lead_id
  where lead.business_id = 'LEAD-018';

  insert into public.crm_recovery_items(crm_lead_id, reason_code, details)
  values (
    missing_phone_lead,
    'missing_phone',
    'Synthetic reset fixture: add a fictional phone before recording an outbound contact attempt.'
  );

  select id into active_rule from public.rule_versions where active;
  if active_rule is null then raise exception 'active rule version required' using errcode = '23514'; end if;

  insert into public.source_events(
    id, channel, source_event_id, inbound_at, source_detail, fictional_phone,
    consent_context, correlation_id
  ) values (
    sla_event, 'organic', 'wi005-sla-fixture', '2026-09-15 17:00:00+00',
    'WI-005 synthetic escalation SLA fixture', '+15550197',
    '{"status":"granted","source":"synthetic_fixture","conversation_window_open":true}',
    'wi005-reset-sla-fixture'
  );

  insert into private.restricted_event_evidence(source_event_id, original_body, body_sha256)
  values (sla_event, 'Synthetic SLA fixture only; no real person or message.',
    encode(digest('Synthetic SLA fixture only; no real person or message.', 'sha256'), 'hex'));
  insert into public.redacted_event_evidence(source_event_id, redacted_body, redaction_types)
  values (sla_event, 'Synthetic SLA fixture: operator review required.', '{}');
  insert into public.processing_decisions(
    id, source_event_id, rule_version_id, decision, reason_code, safe_explanation, decision_source
  ) values (
    sla_decision, sla_event, active_rule, 'escalate_human', 'synthetic_sla_fixture',
    'Deterministic fixture for escalation ownership and overdue-SLA review.', 'deterministic'
  );
  insert into public.escalations(
    id, decision_id, reason_code, priority, redacted_summary, due_at, suggested_role
  ) values (
    private.fixture_uuid('wi005-sla-escalation'), sla_decision, 'synthetic_sla_fixture', 'normal',
    'Synthetic SLA fixture: operator review required.', '2026-09-15 16:00:00+00', 'operator'
  );
end;
$$;

alter function public.reset_synthetic_baseline(uuid, text, text, text)
  rename to reset_synthetic_baseline_wi004;

create function public.reset_synthetic_baseline(
  p_actor_id uuid, p_confirmation text, p_reason text, p_correlation_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  counts jsonb;
begin
  if p_confirmation <> 'RESET SYNTHETIC BASELINE' then
    raise exception 'invalid reset confirmation' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.app_users where id = p_actor_id and role = 'supervisor' and active
  ) then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null or nullif(trim(p_correlation_id), '') is null then
    raise exception 'reset reason and correlation_id are required' using errcode = '22023';
  end if;

  perform set_config('app.synthetic_reset', 'on', true);
  delete from public.outbox_delivery_attempts;
  delete from public.outbox_events;
  delete from public.partner_transfers;
  delete from public.crm_disposition_events;
  delete from public.crm_follow_up_drafts;
  delete from public.crm_recovery_items;
  delete from public.crm_lead_states;

  counts := public.reset_synthetic_baseline_wi004(
    p_actor_id, p_confirmation, p_reason, p_correlation_id
  );
  perform private.seed_wi005_synthetic_fixtures(p_actor_id);

  counts := counts || jsonb_build_object(
    'source_events', (select count(*) from public.source_events),
    'decisions', (select count(*) from public.processing_decisions),
    'drafts', (select count(*) from public.response_drafts),
    'escalations', (select count(*) from public.escalations),
    'ai_attempts', (select count(*) from public.ai_attempts),
    'crm_leads', (select count(*) from public.crm_lead_states),
    'crm_recovery_items', (select count(*) from public.crm_recovery_items),
    'partner_transfers', (select count(*) from public.partner_transfers),
    'outbox_events', (select count(*) from public.outbox_events),
    'outbox_delivery_attempts', (select count(*) from public.outbox_delivery_attempts)
  );
  insert into public.audit_events(actor_id, action, correlation_id, reason, outcome, safe_metadata)
  values (
    p_actor_id,
    'synthetic_crm_fixtures.seeded',
    p_correlation_id,
    p_reason,
    'succeeded',
    counts
  );
  return counts;
end;
$$;

revoke all on function private.seed_wi005_synthetic_fixtures(uuid) from public, anon, authenticated;
revoke all on function public.reset_synthetic_baseline(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reset_synthetic_baseline(uuid, text, text, text) to service_role;
