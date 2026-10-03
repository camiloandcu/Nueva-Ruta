create type public.processing_decision as enum ('respond', 'ignore', 'escalate_human');
create type public.draft_status as enum ('pending', 'approved', 'blocked');
create type public.escalation_status as enum ('open', 'resolved');

create table public.source_events (
  id uuid primary key,
  channel public.lead_channel not null,
  source_event_id text not null check (length(trim(source_event_id)) > 0),
  inbound_at timestamptz not null,
  source_detail text not null,
  fictional_phone text not null check (fictional_phone ~ '^\+155501[0-9]{2}$'),
  consent_context jsonb not null check (jsonb_typeof(consent_context) = 'object'),
  correlation_id text not null,
  result jsonb,
  synthetic boolean not null default true check (synthetic),
  created_at timestamptz not null default now(),
  unique (channel, source_event_id)
);

create table private.restricted_event_evidence (
  source_event_id uuid primary key references public.source_events(id) on delete cascade,
  original_body text not null,
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table public.redacted_event_evidence (
  source_event_id uuid primary key references public.source_events(id) on delete cascade,
  redacted_body text not null,
  redaction_types text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.processing_decisions (
  id uuid primary key,
  source_event_id uuid not null unique references public.source_events(id) on delete cascade,
  rule_version_id uuid not null references public.rule_versions(id) on delete restrict,
  decision public.processing_decision not null,
  reason_code text not null,
  safe_explanation text not null,
  decision_source text not null check (decision_source in ('deterministic','ai_assisted','deterministic_fallback')),
  created_at timestamptz not null default now()
);

create table public.extracted_lead_fields (
  decision_id uuid primary key references public.processing_decisions(id) on delete cascade,
  approved_fields jsonb not null check (jsonb_typeof(approved_fields) = 'object'),
  source text not null check (source in ('deterministic','ai_assisted')),
  confidence numeric(4,3),
  created_at timestamptz not null default now(),
  check (not (approved_fields ?| array['ssn','account_number','credentials','creditors','income','expenses','rates','fees','credit_score']))
);

create table public.response_drafts (
  id uuid primary key,
  decision_id uuid not null unique references public.processing_decisions(id) on delete cascade,
  content text not null,
  content_checksum text not null check (content_checksum ~ '^[0-9a-f]{64}$'),
  status public.draft_status not null default 'pending',
  rule_version_id uuid not null references public.rule_versions(id) on delete restrict,
  model text,
  approved_content text,
  approved_checksum text check (approved_checksum is null or approved_checksum ~ '^[0-9a-f]{64}$'),
  approved_by uuid references public.app_users(id) on delete restrict,
  approved_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  check (delivered_at is null)
);

create table public.escalations (
  id uuid primary key,
  decision_id uuid not null references public.processing_decisions(id) on delete cascade,
  reason_code text not null,
  priority text not null check (priority in ('normal','high','urgent')),
  redacted_summary text not null,
  due_at timestamptz not null,
  suggested_role public.app_role not null,
  status public.escalation_status not null default 'open',
  violation_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (decision_id, reason_code)
);

create table public.ai_attempts (
  id bigint generated always as identity primary key,
  decision_id uuid not null references public.processing_decisions(id) on delete cascade,
  correlation_id text not null,
  status text not null check (status in ('not_attempted','skipped_configuration','succeeded','failed','rejected')),
  failure_layer text not null check (failure_layer in ('none','configuration','transport','provider','output_validation','compliance')),
  normalized_reason text not null,
  provider text not null,
  model text not null default '',
  prompt_version text not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cost_usd numeric(12,6) check (cost_usd is null or cost_usd >= 0),
  safe_metadata jsonb not null default '{}' check (jsonb_typeof(safe_metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.simulated_automatic_effects (
  id uuid primary key,
  source_event_id uuid not null references public.source_events(id) on delete cascade,
  rule_version_id uuid not null references public.rule_versions(id) on delete restrict,
  purpose text not null check (purpose in ('receipt_privacy','after_hours','opt_out_confirmation')),
  template_version integer not null check (template_version > 0),
  body_checksum text not null check (body_checksum ~ '^[0-9a-f]{64}$'),
  delivery_status text not null default 'simulated_not_delivered' check (delivery_status = 'simulated_not_delivered'),
  created_at timestamptz not null default now(),
  unique (source_event_id, purpose, template_version, rule_version_id)
);

create table public.draft_review_events (
  id bigint generated always as identity primary key,
  draft_id uuid not null references public.response_drafts(id) on delete cascade,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  before_checksum text not null,
  submitted_checksum text not null,
  rule_version_id uuid not null references public.rule_versions(id) on delete restrict,
  model text,
  outcome text not null check (outcome in ('approved','blocked')),
  violation_codes text[] not null default '{}',
  correlation_id text not null,
  created_at timestamptz not null default now()
);

create or replace function private.reject_append_only_mutation() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name using errcode = '55000'; end; $$;
create trigger ai_attempts_append_only before update or delete on public.ai_attempts
for each row execute function private.reject_append_only_mutation();
create trigger draft_review_events_append_only before update or delete on public.draft_review_events
for each row execute function private.reject_append_only_mutation();

create view public.operational_redacted_leads as
select se.id as source_event_id, se.channel, se.source_event_id as external_event_id,
  se.inbound_at as received_at, se.source_detail, se.fictional_phone, se.correlation_id,
  re.redacted_body, re.redaction_types, pd.id as decision_id, pd.decision, pd.reason_code
from public.source_events se
join public.redacted_event_evidence re on re.source_event_id = se.id
join public.processing_decisions pd on pd.source_event_id = se.id;

create or replace function public.ingest_source_event(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  event_data jsonb := p_payload->'event'; result_data jsonb := p_payload->'result';
  existing jsonb; event_uuid uuid := (result_data->>'lead_id')::uuid;
  active_rule uuid; draft_body text := p_payload->>'draft_body'; escalation_data jsonb := p_payload->'escalation';
begin
  perform pg_advisory_xact_lock(hashtextextended(event_data->>'channel'||':'||event_data->>'source_event_id', 404));
  select result into existing from public.source_events
    where channel = (event_data->>'channel')::public.lead_channel and source_event_id = event_data->>'source_event_id';
  if existing is not null then return jsonb_set(existing, '{replayed}', 'true'::jsonb); end if;
  select id into active_rule from public.rule_versions where active;
  if active_rule is null then raise exception 'active rule version required' using errcode = '23514'; end if;
  insert into public.source_events(id,channel,source_event_id,inbound_at,source_detail,fictional_phone,consent_context,correlation_id)
  values(event_uuid,(event_data->>'channel')::public.lead_channel,event_data->>'source_event_id',(event_data->>'inbound_at')::timestamptz,
    event_data->>'source_detail',event_data->>'fictional_phone',event_data->'consent',event_data->>'correlation_id');
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

create or replace function public.source_event_result(p_channel text,p_source_event_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare value jsonb; begin
  select result into value from public.source_events where channel=p_channel::public.lead_channel and source_event_id=p_source_event_id;
  if value is null then raise exception 'result not found' using errcode='P0002'; end if; return value;
end; $$;

create or replace function public.review_response_draft(p_draft_id uuid,p_actor_id uuid,p_content text,p_checksum text,p_violation_codes text[],p_correlation_id text) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare selected public.response_drafts%rowtype; escalation_id uuid; begin
  if not exists(select 1 from public.app_users where id=p_actor_id and role in ('operator','supervisor') and active) then raise exception 'operator role required' using errcode='42501'; end if;
  select * into selected from public.response_drafts where id=p_draft_id for update;
  if not found then raise exception 'draft not found' using errcode='P0002'; end if;
  if selected.status <> 'pending' then raise exception 'draft is not pending' using errcode='55000'; end if;
  if cardinality(p_violation_codes)>0 then
    escalation_id:=private.fixture_uuid('draft-blocked-'||p_draft_id::text);
    insert into public.escalations(id,decision_id,reason_code,priority,redacted_summary,due_at,suggested_role,violation_codes)
    values(escalation_id,selected.decision_id,'approval_compliance_blocked','high','Draft blocked by deterministic compliance validation.',now()+interval '30 minutes','supervisor',p_violation_codes)
    on conflict(decision_id,reason_code) do update set violation_codes=excluded.violation_codes,priority='high';
    insert into public.draft_review_events(draft_id,actor_id,before_checksum,submitted_checksum,rule_version_id,model,outcome,violation_codes,correlation_id)
    values(p_draft_id,p_actor_id,selected.content_checksum,p_checksum,selected.rule_version_id,selected.model,'blocked',p_violation_codes,p_correlation_id);
    return jsonb_build_object('approved',false,'violation_codes',p_violation_codes,'escalation_id',escalation_id);
  end if;
  update public.response_drafts set status='approved',approved_content=p_content,approved_checksum=p_checksum,approved_by=p_actor_id,approved_at=now() where id=p_draft_id;
  insert into public.draft_review_events(draft_id,actor_id,before_checksum,submitted_checksum,rule_version_id,model,outcome,correlation_id)
  values(p_draft_id,p_actor_id,selected.content_checksum,p_checksum,selected.rule_version_id,selected.model,'approved',p_correlation_id);
  return jsonb_build_object('approved',true,'draft_id',p_draft_id,'delivered',false,'checksum',p_checksum);
end; $$;

alter function public.reset_synthetic_baseline(uuid,text,text,text) rename to reset_synthetic_baseline_core;
create or replace function public.reset_synthetic_baseline(p_actor_id uuid,p_confirmation text,p_reason text,p_correlation_id text) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare counts jsonb; begin
  delete from public.source_events;
  counts:=public.reset_synthetic_baseline_core(p_actor_id,p_confirmation,p_reason,p_correlation_id);
  return counts || jsonb_build_object('source_events',0,'decisions',0,'drafts',0,'escalations',0,'ai_attempts',0);
end; $$;

revoke all on private.restricted_event_evidence from public,anon,authenticated,service_role;
revoke all on public.source_events,public.redacted_event_evidence,public.processing_decisions,public.extracted_lead_fields,public.response_drafts,public.escalations,public.ai_attempts,public.simulated_automatic_effects,public.draft_review_events from anon,authenticated;
grant select,insert,update,delete on public.source_events,public.redacted_event_evidence,public.processing_decisions,public.extracted_lead_fields,public.response_drafts,public.escalations,public.ai_attempts,public.simulated_automatic_effects,public.draft_review_events to service_role;
grant select on public.operational_redacted_leads to service_role;
grant usage,select on sequence public.ai_attempts_id_seq,public.draft_review_events_id_seq to service_role;
revoke all on function public.ingest_source_event(jsonb),public.source_event_result(text,text),public.review_response_draft(uuid,uuid,text,text,text[],text),public.reset_synthetic_baseline(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ingest_source_event(jsonb),public.source_event_result(text,text),public.review_response_draft(uuid,uuid,text,text,text[],text),public.reset_synthetic_baseline(uuid,text,text,text) to service_role;
alter table public.source_events enable row level security;
alter table public.redacted_event_evidence enable row level security;
alter table public.processing_decisions enable row level security;
alter table public.extracted_lead_fields enable row level security;
alter table public.response_drafts enable row level security;
alter table public.escalations enable row level security;
alter table public.ai_attempts enable row level security;
alter table public.simulated_automatic_effects enable row level security;
alter table public.draft_review_events enable row level security;
