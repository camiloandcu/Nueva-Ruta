create type public.crm_commercial_stage as enum (
  'new', 'under_review', 'prequalified', 'contact_attempted', 'info_sent',
  'callback_scheduled', 'transferred', 'enrolled', 'closed_not_interested'
);
create type public.crm_disposition as enum (
  'No Answer', 'Info Sent', 'Transferido', 'Call Back', 'No le interesa'
);
create type public.partner_transfer_status as enum ('pending', 'accepted', 'dead_letter');
create type public.outbox_delivery_status as enum (
  'pending', 'processing', 'retry_scheduled', 'delivered', 'dead_letter'
);
alter table public.leads alter column fictional_phone drop not null;

create table public.crm_lead_states (
  id uuid primary key default gen_random_uuid(),
  baseline_lead_id uuid unique references public.leads(id) on delete cascade,
  source_event_id uuid unique references public.source_events(id) on delete cascade,
  commercial_stage public.crm_commercial_stage not null default 'new',
  qualified_by uuid references public.app_users(id) on delete restrict,
  qualified_at timestamptz,
  opted_out_at timestamptz,
  opt_out_actor_id uuid references public.app_users(id) on delete restrict,
  opt_out_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((baseline_lead_id is null) <> (source_event_id is null))
);
insert into public.crm_lead_states(baseline_lead_id, commercial_stage)
select id, case initial_status when 'needs_review' then 'under_review'::public.crm_commercial_stage
  when 'ignored' then 'closed_not_interested'::public.crm_commercial_stage
  else 'new'::public.crm_commercial_stage end from public.leads;

create function private.create_crm_state_for_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.crm_lead_states(source_event_id, commercial_stage)
  values (new.id, 'under_review') on conflict (source_event_id) do nothing;
  return new;
end; $$;
create trigger source_event_crm_state after insert on public.source_events
for each row execute function private.create_crm_state_for_event();

alter table public.escalations
  add column owner_id uuid references public.app_users(id) on delete restrict,
  add column lifecycle_state text not null default 'pending'
    check (lifecycle_state in ('pending','assigned','in_review','resolved','closed_with_reason')),
  add column claimed_at timestamptz,
  add column resolved_at timestamptz,
  add column closed_at timestamptz,
  add column resolution_action text,
  add column resolution_reason text,
  add column sla_breached_at timestamptz;

create table public.crm_recovery_items (
  id uuid primary key default gen_random_uuid(),
  crm_lead_id uuid not null references public.crm_lead_states(id) on delete cascade,
  reason_code text not null check (reason_code in ('missing_phone','invalid_disposition','partner_delivery')),
  status text not null default 'open' check (status in ('open','resolved')),
  details text not null,
  created_by uuid references public.app_users(id) on delete restrict,
  resolved_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index crm_recovery_one_open_reason on public.crm_recovery_items(crm_lead_id,reason_code) where status='open';

create table public.crm_follow_up_drafts (
  id uuid primary key default gen_random_uuid(),
  crm_lead_id uuid not null references public.crm_lead_states(id) on delete restrict,
  disposition_key text not null unique,
  content text not null,
  content_checksum text not null check (content_checksum ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected')),
  created_by uuid not null references public.app_users(id) on delete restrict,
  approved_by uuid references public.app_users(id) on delete restrict,
  approved_at timestamptz,
  rule_version_id uuid references public.rule_versions(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.crm_disposition_events (
  id uuid primary key default gen_random_uuid(),
  crm_lead_id uuid not null references public.crm_lead_states(id) on delete restrict,
  idempotency_key text not null unique,
  disposition public.crm_disposition not null,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  prior_stage public.crm_commercial_stage not null,
  resulting_stage public.crm_commercial_stage not null,
  reason text not null,
  callback_at timestamptz,
  timezone text,
  draft_id uuid references public.response_drafts(id) on delete restrict,
  crm_follow_up_draft_id uuid references public.crm_follow_up_drafts(id) on delete restrict,
  rule_version_id uuid references public.rule_versions(id) on delete restrict,
  side_effect_status text not null check (side_effect_status in ('none','approved_draft','manual_action_recorded','transfer_accepted')),
  external_action_reference text,
  opt_out_recorded boolean not null default false,
  correlation_id text not null,
  result jsonb not null default '{}'::jsonb
);
create index crm_disposition_lead_time_idx on public.crm_disposition_events(crm_lead_id,occurred_at desc);

create table public.partner_transfers (
  id uuid primary key default gen_random_uuid(),
  crm_lead_id uuid not null references public.crm_lead_states(id) on delete restrict,
  approved_by uuid not null references public.app_users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  reason text not null,
  idempotency_key text not null unique,
  status public.partner_transfer_status not null default 'pending',
  partner_request_id text unique,
  created_at timestamptz not null default now()
);
create unique index partner_transfer_one_per_lead on public.partner_transfers(crm_lead_id);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('partner_transfer')),
  transfer_id uuid not null unique references public.partner_transfers(id) on delete restrict,
  idempotency_key text not null unique,
  status public.outbox_delivery_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  replay_generation integer not null default 0 check (replay_generation >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error_category text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outbox_due_idx on public.outbox_events(next_attempt_at) where status in ('pending','retry_scheduled');

create table public.outbox_delivery_attempts (
  id bigint generated always as identity primary key,
  outbox_event_id uuid not null references public.outbox_events(id) on delete restrict,
  attempt_number integer not null,
  replay_generation integer not null,
  outcome text not null check (outcome in ('delivered','retryable_failure','permanent_failure')),
  error_category text,
  safe_error text,
  partner_request_id text,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  unique (outbox_event_id,replay_generation,attempt_number)
);
create trigger outbox_attempts_append_only before update or delete on public.outbox_delivery_attempts
for each row execute function private.reject_append_only_mutation();

create table public.outbox_policy (
  singleton boolean primary key default true check (singleton),
  maximum_attempts integer not null default 3 check (maximum_attempts between 1 and 10),
  base_delay_seconds integer not null default 30 check (base_delay_seconds between 1 and 3600),
  updated_at timestamptz not null default now()
);
insert into public.outbox_policy(singleton) values (true);

create view public.operational_crm_leads as
select state.id, coalesce(lead.business_id, event.id::text) as business_id,
  coalesce(lead.fictional_phone, event.fictional_phone) as fictional_phone,
  coalesce(lead.received_at, event.inbound_at) as received_at,
  coalesce(lead.initial_status::text, decision.decision::text, 'received') as initial_status,
  state.commercial_stage::text as commercial_stage, state.baseline_lead_id, state.source_event_id,
  redacted.redacted_body, redacted.redaction_types,
  (consent.status = 'withdrawn' or event.consent_context->>'status' = 'withdrawn' or state.opted_out_at is not null) as opted_out,
  state.updated_at
from public.crm_lead_states state
left join public.leads lead on lead.id=state.baseline_lead_id
left join public.source_events event on event.id=state.source_event_id
left join public.processing_decisions decision on decision.source_event_id=event.id
left join public.redacted_event_evidence redacted on redacted.source_event_id=event.id
left join public.consent_evidence consent on consent.lead_id=lead.id;

create view public.operational_escalations as
select e.*, (e.status <> 'resolved' and e.due_at < now()) as sla_breached,
  coalesce(state.id::text, e.decision_id::text) as operational_lead_id
from public.escalations e
left join public.processing_decisions d on d.id=e.decision_id
left join public.crm_lead_states state on state.source_event_id=d.source_event_id;

create function public.qualify_crm_lead(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid; item public.crm_lead_states%rowtype;
  consent_state text;
begin
  if not exists(select 1 from public.app_users where id=actor and active and role in ('operator','supervisor')) then
    raise exception 'operator role required' using errcode='42501';
  end if;
  select * into item from public.crm_lead_states where id=(p_payload->>'crm_lead_id')::uuid for update;
  if not found then raise exception 'lead not found' using errcode='P0002'; end if;
  if item.commercial_stage not in ('new','under_review') then
    raise exception 'lead cannot be qualified from current stage' using errcode='22023';
  end if;
  if item.baseline_lead_id is not null then
    if exists(select 1 from public.leads where id=item.baseline_lead_id and initial_status='ignored') then
      raise exception 'ignored lead cannot be qualified' using errcode='22023';
    end if;
    select status::text into consent_state from public.consent_evidence where lead_id=item.baseline_lead_id;
  else
    select consent_context->>'status' into consent_state from public.source_events where id=item.source_event_id;
    if exists(select 1 from public.processing_decisions decision where decision.source_event_id=item.source_event_id
      and decision.decision<>'respond' and not exists (
        select 1 from public.escalations escalation where escalation.decision_id=decision.id
          and escalation.status='resolved' and escalation.resolution_action='transfer_eligibility'
      )) then
      raise exception 'non-response decision requires resolved transfer-eligibility review' using errcode='22023';
    end if;
  end if;
  if consent_state='withdrawn' or item.opted_out_at is not null then raise exception 'opted-out lead cannot be qualified' using errcode='22023'; end if;
  if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'reason required' using errcode='22023'; end if;
  update public.crm_lead_states set commercial_stage='prequalified',qualified_by=actor,qualified_at=now(),updated_at=now() where id=item.id;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'crm.lead.qualified',p_payload->>'correlation_id',p_payload->>'reason','succeeded',
    jsonb_build_object('lead_id',item.id,'prior_stage',item.commercial_stage,'resulting_stage','prequalified'));
  return jsonb_build_object('crm_lead_id',item.id,'commercial_stage','prequalified');
end; $$;

create function public.apply_crm_disposition(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid; item public.crm_lead_states%rowtype;
  action public.crm_disposition := (p_payload->>'disposition')::public.crm_disposition;
  next_stage public.crm_commercial_stage; existing jsonb; prior public.crm_commercial_stage;
  phone text; consent_state text; transfer public.partner_transfers%rowtype; callback timestamptz;
  side_effect text := 'none'; rule_id uuid; follow_up_id uuid := nullif(p_payload->>'crm_follow_up_draft_id','')::uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_payload->>'idempotency_key', 805));
  select result into existing from public.crm_disposition_events where idempotency_key=p_payload->>'idempotency_key';
  if existing is not null then return existing || jsonb_build_object('replayed',true); end if;
  if not exists(select 1 from public.app_users where id=actor and active and role in ('operator','supervisor')) then
    raise exception 'operator role required' using errcode='42501';
  end if;
  select * into item from public.crm_lead_states where id=(p_payload->>'crm_lead_id')::uuid for update;
  if not found then raise exception 'lead not found' using errcode='P0002'; end if;
  prior := item.commercial_stage;
  case action
    when 'No Answer' then next_stage:='contact_attempted';
    when 'Info Sent' then next_stage:='info_sent';
    when 'Transferido' then next_stage:='transferred';
    when 'Call Back' then next_stage:='callback_scheduled';
    when 'No le interesa' then next_stage:='closed_not_interested';
  end case;
  if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'reason required' using errcode='22023'; end if;
  if prior not in ('prequalified','contact_attempted','info_sent','callback_scheduled','transferred') and action<>'No le interesa' then
    raise exception 'disposition is not valid from current stage' using errcode='22023';
  end if;
  if action='No le interesa' and prior='enrolled' then raise exception 'enrolled lead cannot be closed as not interested' using errcode='22023'; end if;
  if action='No Answer' then
    if item.baseline_lead_id is not null then select fictional_phone into phone from public.leads where id=item.baseline_lead_id;
    else select fictional_phone into phone from public.source_events where id=item.source_event_id; end if;
    if nullif(phone,'') is null then
      insert into public.crm_recovery_items(crm_lead_id,reason_code,details,created_by)
      values(item.id,'missing_phone','No usable phone is available for the recorded disposition.',actor)
      on conflict (crm_lead_id,reason_code) where status='open' do nothing;
    else
      insert into public.crm_follow_up_drafts(crm_lead_id,disposition_key,content,content_checksum,created_by,rule_version_id)
      values(item.id,p_payload->>'idempotency_key',
        'Hola, intenté comunicarme contigo. Si aún deseas información, podemos continuar cuando te convenga.',
        encode(digest('Hola, intenté comunicarme contigo. Si aún deseas información, podemos continuar cuando te convenga.','sha256'),'hex'),
        actor,(select id from public.rule_versions where active))
      on conflict (disposition_key) do update set disposition_key=excluded.disposition_key returning id into follow_up_id;
    end if;
  elsif action='Info Sent' then
    if nullif(trim(p_payload->>'external_action_reference'),'') is not null then side_effect:='manual_action_recorded';
    elsif p_payload->>'draft_id' is not null and exists(
      select 1 from public.response_drafts draft
      join public.processing_decisions decision on decision.id=draft.decision_id
      where draft.id=(p_payload->>'draft_id')::uuid and draft.status='approved'
        and decision.source_event_id=item.source_event_id
    ) then side_effect:='approved_draft';
    elsif p_payload->>'crm_follow_up_draft_id' is not null and exists(
      select 1 from public.crm_follow_up_drafts where id=(p_payload->>'crm_follow_up_draft_id')::uuid
        and crm_lead_id=item.id and status='approved'
    ) then side_effect:='approved_draft';
    else raise exception 'approved message delivery evidence or manual action reference required' using errcode='22023'; end if;
  elsif action='Transferido' then
    select * into transfer from public.partner_transfers where crm_lead_id=item.id and status='accepted';
    if not found or transfer.partner_request_id is null then
      raise exception 'accepted approved transfer required' using errcode='22023';
    end if;
    side_effect:='transfer_accepted';
  elsif action='Call Back' then
    if nullif(p_payload->>'callback_at','') is null then raise exception 'future callback timestamp required' using errcode='22023'; end if;
    callback := (p_payload->>'callback_at')::timestamptz;
    if callback<=now() or nullif(trim(p_payload->>'timezone'),'') is null then
      raise exception 'future callback timestamp and timezone required' using errcode='22023';
    end if;
  elsif action='No le interesa' and coalesce((p_payload->>'explicit_opt_out')::boolean,false) then
    update public.crm_lead_states set opted_out_at=now(),opt_out_actor_id=actor,opt_out_reason=p_payload->>'reason' where id=item.id;
  end if;
  select id into rule_id from public.rule_versions where active;
  update public.crm_lead_states set commercial_stage=next_stage,updated_at=now() where id=item.id;
  insert into public.crm_disposition_events(crm_lead_id,idempotency_key,disposition,actor_id,prior_stage,resulting_stage,reason,
    callback_at,timezone,draft_id,crm_follow_up_draft_id,rule_version_id,side_effect_status,external_action_reference,opt_out_recorded,correlation_id)
  values(item.id,p_payload->>'idempotency_key',action,actor,prior,next_stage,p_payload->>'reason',callback,p_payload->>'timezone',
    nullif(p_payload->>'draft_id','')::uuid,follow_up_id,rule_id,side_effect,p_payload->>'external_action_reference',
    action='No le interesa' and coalesce((p_payload->>'explicit_opt_out')::boolean,false),p_payload->>'correlation_id');
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'crm.disposition.applied',p_payload->>'correlation_id',p_payload->>'reason','succeeded',
    jsonb_build_object('lead_id',item.id,'disposition',action,'prior_stage',prior,'resulting_stage',next_stage,'side_effect_status',side_effect));
  existing:=jsonb_build_object('crm_lead_id',item.id,'disposition',action,'prior_stage',prior,'commercial_stage',next_stage,
    'side_effect_status',side_effect,'generated_draft_id',follow_up_id,'partner_request_id',transfer.partner_request_id,
    'correlation_id',p_payload->>'correlation_id','replayed',false);
  update public.crm_disposition_events set result=existing where idempotency_key=p_payload->>'idempotency_key';
  return existing;
end; $$;

create function public.approve_partner_transfer(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid; item public.crm_lead_states%rowtype;
  transfer public.partner_transfers%rowtype; event_uuid uuid; consent_state text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_payload->>'idempotency_key', 806));
  select * into transfer from public.partner_transfers where idempotency_key=p_payload->>'idempotency_key';
  if found then return jsonb_build_object('transfer_id',transfer.id,'status',transfer.status,'replayed',true); end if;
  if not exists(select 1 from public.app_users where id=actor and active and role in ('operator','supervisor')) then
    raise exception 'operator role required' using errcode='42501';
  end if;
  select * into item from public.crm_lead_states where id=(p_payload->>'crm_lead_id')::uuid for update;
  if not found then raise exception 'lead not found' using errcode='P0002'; end if;
  if item.commercial_stage not in ('prequalified','contact_attempted','info_sent','callback_scheduled') then
    raise exception 'lead is not eligible for partner transfer' using errcode='22023';
  end if;
  if item.baseline_lead_id is not null then
    select status::text into consent_state from public.consent_evidence where lead_id=item.baseline_lead_id;
  else
    select consent_context->>'status' into consent_state from public.source_events where id=item.source_event_id;
    if exists(select 1 from public.processing_decisions decision join public.escalations escalation on escalation.decision_id=decision.id
      where decision.source_event_id=item.source_event_id and escalation.status<>'resolved') then
      raise exception 'open escalation must be resolved before transfer' using errcode='22023';
    end if;
  end if;
  if consent_state='withdrawn' or item.opted_out_at is not null then raise exception 'opted-out lead cannot be transferred' using errcode='22023'; end if;
  if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'approval reason required' using errcode='22023'; end if;
  insert into public.partner_transfers(crm_lead_id,approved_by,reason,idempotency_key)
  values(item.id,actor,p_payload->>'reason',p_payload->>'idempotency_key') returning * into transfer;
  insert into public.outbox_events(event_type,transfer_id,idempotency_key)
  values('partner_transfer',transfer.id,transfer.id::text) returning id into event_uuid;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'partner.transfer.approved',p_payload->>'correlation_id',p_payload->>'reason','succeeded',
    jsonb_build_object('transfer_id',transfer.id,'crm_lead_id',item.id));
  return jsonb_build_object('transfer_id',transfer.id,'outbox_event_id',event_uuid,'status','pending','approved_by',actor,'replayed',false);
end; $$;

create function public.claim_partner_outbox(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.outbox_events%rowtype; transfer public.partner_transfers%rowtype;
  lead_state public.crm_lead_states%rowtype;
begin
  select * into item from public.outbox_events where id=p_event_id for update skip locked;
  if not found or item.status not in ('pending','retry_scheduled') or item.next_attempt_at>now() then return null; end if;
  update public.outbox_events set status='processing',updated_at=now(),attempt_count=attempt_count+1
    where id=item.id returning * into item;
  select * into transfer from public.partner_transfers where id=item.transfer_id;
  select * into lead_state from public.crm_lead_states where id=transfer.crm_lead_id;
  return jsonb_build_object('event_id',item.id,'transfer_id',transfer.id,'attempt_number',item.attempt_count,
    'replay_generation',item.replay_generation,'idempotency_key',item.idempotency_key,'crm_lead_id',lead_state.id,
    'baseline_lead_id',lead_state.baseline_lead_id,'source_event_id',lead_state.source_event_id);
end; $$;

create function public.complete_partner_outbox(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.outbox_events%rowtype; policy public.outbox_policy%rowtype;
  outcome text := p_payload->>'outcome'; attempt integer := (p_payload->>'attempt_number')::integer;
  delay_seconds integer; lead_id uuid;
begin
  select * into item from public.outbox_events where id=(p_payload->>'event_id')::uuid for update;
  if not found or item.status<>'processing' or item.attempt_count<>attempt then
    raise exception 'outbox event is not processing' using errcode='55000';
  end if;
  select * into policy from public.outbox_policy where singleton;
  if outcome='delivered' then
    if nullif(p_payload->>'partner_request_id','') is null then raise exception 'partner request ID required' using errcode='22023'; end if;
    update public.outbox_events set status='delivered',last_error_category=null,last_error_message=null,updated_at=now() where id=item.id;
    update public.partner_transfers set status='accepted',partner_request_id=p_payload->>'partner_request_id' where id=item.transfer_id returning crm_lead_id into lead_id;
    update public.crm_lead_states set commercial_stage='transferred',updated_at=now() where id=lead_id;
  elsif outcome='retryable_failure' and attempt<policy.maximum_attempts then
    delay_seconds := policy.base_delay_seconds * (2 ^ greatest(attempt-1,0));
    update public.outbox_events set status='retry_scheduled',next_attempt_at=now()+make_interval(secs=>delay_seconds),
      last_error_category=p_payload->>'error_category',last_error_message=left(p_payload->>'safe_error',200),updated_at=now() where id=item.id;
  elsif outcome in ('retryable_failure','permanent_failure') then
    update public.outbox_events set status='dead_letter',last_error_category=p_payload->>'error_category',
      last_error_message=left(p_payload->>'safe_error',200),updated_at=now() where id=item.id;
    update public.partner_transfers set status='dead_letter' where id=item.transfer_id returning crm_lead_id into lead_id;
    insert into public.crm_recovery_items(crm_lead_id,reason_code,details)
    values(lead_id,'partner_delivery','Partner transfer exhausted delivery attempts and requires review.')
    on conflict (crm_lead_id,reason_code) where status='open' do nothing;
  else raise exception 'unknown delivery outcome' using errcode='22023'; end if;
  insert into public.outbox_delivery_attempts(outbox_event_id,attempt_number,replay_generation,outcome,error_category,safe_error,
    partner_request_id,started_at)
  values(item.id,attempt,item.replay_generation,outcome,nullif(p_payload->>'error_category',''),
    left(p_payload->>'safe_error',200),p_payload->>'partner_request_id',coalesce((p_payload->>'started_at')::timestamptz,now()));
  return jsonb_build_object('event_id',item.id,'status',(select status from public.outbox_events where id=item.id),
    'attempt_number',attempt,'next_attempt_at',(select next_attempt_at from public.outbox_events where id=item.id),
    'partner_request_id',p_payload->>'partner_request_id');
end; $$;

create function public.replay_partner_outbox(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid; item public.outbox_events%rowtype;
begin
  if not exists(select 1 from public.app_users where id=actor and active and role in ('operator','supervisor')) then
    raise exception 'operator role required' using errcode='42501';
  end if;
  select * into item from public.outbox_events where id=(p_payload->>'event_id')::uuid for update;
  if not found or item.status<>'dead_letter' then raise exception 'only dead-letter effects may be replayed' using errcode='22023'; end if;
  if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'replay reason required' using errcode='22023'; end if;
  update public.outbox_events set status='pending',attempt_count=0,replay_generation=replay_generation+1,
    next_attempt_at=now(),last_error_category=null,last_error_message=null,updated_at=now() where id=item.id;
  update public.partner_transfers set status='pending' where id=item.transfer_id;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'partner.delivery.replayed',p_payload->>'correlation_id',p_payload->>'reason','succeeded',
    jsonb_build_object('event_id',item.id,'replay_generation',item.replay_generation+1,'idempotency_key',item.idempotency_key));
  return jsonb_build_object('event_id',item.id,'status','pending','replay_generation',item.replay_generation+1);
end; $$;

create function public.approve_crm_follow_up_draft(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid; draft public.crm_follow_up_drafts%rowtype;
begin
  if not exists(select 1 from public.app_users where id=actor and active and role in ('operator','supervisor')) then
    raise exception 'operator role required' using errcode='42501';
  end if;
  select * into draft from public.crm_follow_up_drafts where id=(p_payload->>'draft_id')::uuid for update;
  if not found then raise exception 'follow-up draft not found' using errcode='P0002'; end if;
  if draft.status='approved' then return jsonb_build_object('draft_id',draft.id,'status','approved','replayed',true); end if;
  if draft.status<>'pending_review' then raise exception 'follow-up draft is not pending review' using errcode='55000'; end if;
  update public.crm_follow_up_drafts set status='approved',content=p_payload->>'content',
    content_checksum=p_payload->>'content_checksum',approved_by=actor,approved_at=now() where id=draft.id;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'crm.follow_up_draft.approved',p_payload->>'correlation_id',p_payload->>'reason','succeeded',
    jsonb_build_object('draft_id',draft.id,'crm_lead_id',draft.crm_lead_id,'checksum',p_payload->>'content_checksum'));
  return jsonb_build_object('draft_id',draft.id,'status','approved','checksum',p_payload->>'content_checksum','replayed',false);
end; $$;

create function public.record_crm_command_failure(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid; crm_lead uuid := (p_payload->>'crm_lead_id')::uuid;
  error_code text := p_payload->>'error_code';
begin
  if not exists(select 1 from public.app_users where id=actor and active and role in ('operator','supervisor')) then
    raise exception 'operator role required' using errcode='42501';
  end if;
  if not exists(select 1 from public.crm_lead_states where id=crm_lead) then
    raise exception 'lead not found' using errcode='P0002';
  end if;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'crm.disposition.rejected',p_payload->>'correlation_id','Disposition command rejected','failed',
    jsonb_build_object('crm_lead_id',crm_lead,'error_code',error_code));
  if error_code='22P02' then
    insert into public.crm_recovery_items(crm_lead_id,reason_code,details,created_by)
    values(crm_lead,'invalid_disposition','Unsupported disposition was rejected. Select one of the five documented values.',actor)
    on conflict (crm_lead_id,reason_code) where status='open' do nothing;
  end if;
  return jsonb_build_object('recorded',true,'error_code',error_code);
end; $$;

create function public.apply_escalation_action(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid; action text := p_payload->>'action';
  selected public.escalations%rowtype; actor_role public.app_role;
begin
  select * into selected from public.escalations where id=(p_payload->>'escalation_id')::uuid for update;
  if not found then raise exception 'escalation not found' using errcode='P0002'; end if;
  select role into actor_role from public.app_users where id=actor and active;
  if actor_role is null then raise exception 'active actor required' using errcode='42501'; end if;
  if selected.status<>'resolved' and selected.due_at<now() and selected.sla_breached_at is null then
    update public.escalations set sla_breached_at=now() where id=selected.id;
    insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
    values(actor,'escalation.sla_breached',p_payload->>'correlation_id','Escalation SLA exceeded','succeeded',
      jsonb_build_object('escalation_id',selected.id,'due_at',selected.due_at,'owner_id',selected.owner_id));
  end if;
  if action='assign' then
    if actor_role<>'supervisor' then raise exception 'supervisor role required' using errcode='42501'; end if;
    if selected.status='resolved' then raise exception 'resolved escalation cannot be reassigned' using errcode='22023'; end if;
    if not exists(select 1 from public.app_users where id=(p_payload->>'owner_id')::uuid and active and role in ('operator','supervisor')) then
      raise exception 'valid owner required' using errcode='22023'; end if;
    update public.escalations set owner_id=(p_payload->>'owner_id')::uuid,lifecycle_state='assigned' where id=selected.id;
  elsif action='claim' then
    if actor_role not in ('operator','supervisor') or (selected.owner_id is not null and selected.owner_id<>actor) then
      raise exception 'escalation is assigned to another user' using errcode='42501'; end if;
    if selected.status='resolved' then raise exception 'resolved escalation cannot be claimed' using errcode='22023'; end if;
    update public.escalations set owner_id=actor,claimed_at=now(),lifecycle_state='in_review' where id=selected.id and status<>'resolved';
  elsif action in ('resolve','close') then
    if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'resolution reason required' using errcode='22023'; end if;
    if selected.owner_id is not null and selected.owner_id<>actor and actor_role<>'supervisor' then
      raise exception 'only owner or supervisor may resolve' using errcode='42501'; end if;
    if action='resolve' and p_payload->>'resolution_action' not in ('create_draft','request_information','transfer_eligibility','link_reconciliation','close') then
      raise exception 'unknown escalation resolution action' using errcode='22023'; end if;
    if action='close' and actor_role<>'supervisor' then raise exception 'supervisor role required to close' using errcode='42501'; end if;
    update public.escalations set status='resolved',lifecycle_state=case when action='close' then 'closed_with_reason' else 'resolved' end,
      resolution_action=p_payload->>'resolution_action',resolution_reason=p_payload->>'reason',resolved_at=now(),
      closed_at=case when action='close' then now() else closed_at end where id=selected.id;
  else raise exception 'unknown escalation action' using errcode='22023'; end if;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'escalation.'||action,p_payload->>'correlation_id',coalesce(p_payload->>'reason',action),'succeeded',
    jsonb_build_object('escalation_id',selected.id,'owner_id',coalesce(p_payload->>'owner_id',actor::text),'prior_state',selected.lifecycle_state));
  return jsonb_build_object('escalation_id',selected.id,'action',action,
    'lifecycle_state',(select lifecycle_state from public.escalations where id=selected.id),
    'owner_id',(select owner_id from public.escalations where id=selected.id));
end; $$;

revoke all on public.crm_lead_states,public.crm_recovery_items,public.crm_follow_up_drafts,public.crm_disposition_events,public.partner_transfers,
  public.outbox_events,public.outbox_delivery_attempts,public.outbox_policy from anon,authenticated;
grant select,insert,update,delete on public.crm_lead_states,public.crm_recovery_items,public.crm_follow_up_drafts,public.crm_disposition_events,
  public.partner_transfers,public.outbox_events,public.outbox_policy to service_role;
grant select,insert on public.outbox_delivery_attempts to service_role;
grant select on public.operational_crm_leads,public.operational_escalations to service_role;
grant usage,select on sequence public.outbox_delivery_attempts_id_seq to service_role;
alter table public.crm_lead_states enable row level security;
alter table public.crm_recovery_items enable row level security;
alter table public.crm_follow_up_drafts enable row level security;
alter table public.crm_disposition_events enable row level security;
alter table public.partner_transfers enable row level security;
alter table public.outbox_events enable row level security;
alter table public.outbox_delivery_attempts enable row level security;
alter table public.outbox_policy enable row level security;

revoke all on function public.qualify_crm_lead(jsonb),public.apply_crm_disposition(jsonb),public.approve_partner_transfer(jsonb),
  public.claim_partner_outbox(uuid),public.complete_partner_outbox(jsonb),public.replay_partner_outbox(jsonb),
  public.apply_escalation_action(jsonb),public.approve_crm_follow_up_draft(jsonb),public.record_crm_command_failure(jsonb)
  from public,anon,authenticated;
grant execute on function public.qualify_crm_lead(jsonb),public.apply_crm_disposition(jsonb),public.approve_partner_transfer(jsonb),
  public.claim_partner_outbox(uuid),public.complete_partner_outbox(jsonb),public.replay_partner_outbox(jsonb),
  public.apply_escalation_action(jsonb),public.approve_crm_follow_up_draft(jsonb),public.record_crm_command_failure(jsonb)
  to service_role;
