create table public.crm_message_delivery_events (
  id uuid primary key default gen_random_uuid(),
  crm_lead_id uuid not null references public.crm_lead_states(id) on delete restrict,
  response_draft_id uuid references public.response_drafts(id) on delete restrict,
  crm_follow_up_draft_id uuid references public.crm_follow_up_drafts(id) on delete restrict,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  channel text not null default 'simulated' check (channel = 'simulated'),
  content_checksum text not null check (content_checksum ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null unique,
  correlation_id text not null,
  delivered_at timestamptz not null default now(),
  result jsonb not null default '{}'::jsonb,
  check ((response_draft_id is null) <> (crm_follow_up_draft_id is null))
);
create unique index crm_message_delivery_response_once
  on public.crm_message_delivery_events(response_draft_id) where response_draft_id is not null;
create unique index crm_message_delivery_follow_up_once
  on public.crm_message_delivery_events(crm_follow_up_draft_id) where crm_follow_up_draft_id is not null;
create index crm_message_delivery_case_time
  on public.crm_message_delivery_events(crm_lead_id,delivered_at desc);
create trigger crm_message_delivery_append_only before update or delete
  on public.crm_message_delivery_events for each row execute function private.reject_append_only_mutation();

alter table public.crm_disposition_events
  add column delivery_event_id uuid references public.crm_message_delivery_events(id) on delete restrict;
alter table public.crm_disposition_events drop constraint crm_disposition_events_side_effect_status_check;
alter table public.crm_disposition_events add constraint crm_disposition_events_side_effect_status_check
  check (side_effect_status in ('none','approved_draft','manual_action_recorded','simulated_delivery','transfer_accepted'));

create view public.operational_crm_message_evidence as
select state.id as crm_lead_id, 'intake'::text as draft_kind, draft.id as draft_id,
  draft.approved_content as content, draft.approved_checksum as content_checksum,
  draft.approved_at, delivery.id as delivery_event_id, delivery.delivered_at
from public.response_drafts draft
join public.processing_decisions decision on decision.id=draft.decision_id
join public.crm_lead_states state on state.source_event_id=decision.source_event_id
left join public.crm_message_delivery_events delivery on delivery.response_draft_id=draft.id
where draft.status='approved' and draft.approved_content is not null and draft.approved_checksum is not null
union all
select draft.crm_lead_id, 'follow_up'::text, draft.id, draft.content,
  draft.content_checksum, draft.approved_at, delivery.id, delivery.delivered_at
from public.crm_follow_up_drafts draft
left join public.crm_message_delivery_events delivery on delivery.crm_follow_up_draft_id=draft.id
where draft.status='approved' and draft.approved_at is not null;

create function public.record_simulated_message_delivery(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid;
  item public.crm_lead_states%rowtype;
  prior public.crm_message_delivery_events%rowtype;
  draft_kind text := p_payload->>'draft_kind';
  draft_uuid uuid := (p_payload->>'draft_id')::uuid;
  checksum text;
  consent_state text;
  response_id uuid;
  follow_up_id uuid;
  delivery_uuid uuid := gen_random_uuid();
  delivery_time timestamptz := now();
  result jsonb;
begin
  if nullif(trim(p_payload->>'idempotency_key'),'') is null
    or nullif(trim(p_payload->>'correlation_id'),'') is null then
    raise exception 'idempotency key and correlation ID required' using errcode='22023';
  end if;
  if not exists(select 1 from public.app_users where id=actor and active and role in ('operator','supervisor')) then
    raise exception 'operator role required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_payload->>'idempotency_key', 807));
  select * into prior from public.crm_message_delivery_events
    where idempotency_key=p_payload->>'idempotency_key';
  if found then
    if prior.crm_lead_id<>(p_payload->>'crm_lead_id')::uuid
      or prior.response_draft_id is distinct from (case when draft_kind='intake' then draft_uuid end)
      or prior.crm_follow_up_draft_id is distinct from (case when draft_kind='follow_up' then draft_uuid end) then
      raise exception 'idempotency key belongs to another delivery' using errcode='22023';
    end if;
    return prior.result || jsonb_build_object('replayed',true);
  end if;
  select * into item from public.crm_lead_states where id=(p_payload->>'crm_lead_id')::uuid for update;
  if not found then raise exception 'lead not found' using errcode='P0002'; end if;
  if item.commercial_stage not in ('prequalified','contact_attempted','info_sent','callback_scheduled','transferred') then
    raise exception 'qualify lead before recording delivery' using errcode='22023';
  end if;
  if item.opted_out_at is not null then raise exception 'opted-out lead cannot receive a message' using errcode='22023'; end if;
  if item.baseline_lead_id is not null then
    select status::text into consent_state from public.consent_evidence where lead_id=item.baseline_lead_id;
  else
    select consent_context->>'status' into consent_state from public.source_events where id=item.source_event_id;
  end if;
  if consent_state is distinct from 'granted' then
    raise exception 'granted consent required for simulated delivery' using errcode='22023';
  end if;
  if draft_kind='intake' then
    select draft.approved_checksum into checksum from public.response_drafts draft
      join public.processing_decisions decision on decision.id=draft.decision_id
      where draft.id=draft_uuid and decision.source_event_id=item.source_event_id
        and draft.status='approved' and draft.approved_content is not null;
    response_id:=draft_uuid;
  elsif draft_kind='follow_up' then
    select content_checksum into checksum from public.crm_follow_up_drafts
      where id=draft_uuid and crm_lead_id=item.id and status='approved';
    follow_up_id:=draft_uuid;
  else
    raise exception 'unknown draft kind' using errcode='22023';
  end if;
  if checksum is null then raise exception 'approved draft does not belong to this lead' using errcode='22023'; end if;
  result:=jsonb_build_object('delivery_event_id',delivery_uuid,'crm_lead_id',item.id,
    'draft_kind',draft_kind,'draft_id',draft_uuid,'channel','simulated',
    'delivered_at',delivery_time,'replayed',false);
  insert into public.crm_message_delivery_events
    (id,crm_lead_id,response_draft_id,crm_follow_up_draft_id,actor_id,content_checksum,
      idempotency_key,correlation_id,delivered_at,result)
  values(delivery_uuid,item.id,response_id,follow_up_id,actor,checksum,
    p_payload->>'idempotency_key',p_payload->>'correlation_id',delivery_time,result);
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'crm.message_delivery.simulated',p_payload->>'correlation_id',
    'Operator recorded simulated message delivery','succeeded',
    jsonb_build_object('crm_lead_id',item.id,'draft_kind',draft_kind,'draft_id',draft_uuid,
      'delivery_event_id',delivery_uuid,'channel','simulated'));
  return result;
end; $$;

alter function public.reset_synthetic_baseline(uuid,text,text,text)
  rename to reset_synthetic_baseline_before_message_delivery;
create function public.reset_synthetic_baseline(
  p_actor_id uuid,p_confirmation text,p_reason text,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  perform set_config('app.synthetic_reset','on',true);
  delete from public.crm_disposition_events;
  delete from public.crm_message_delivery_events;
  return public.reset_synthetic_baseline_before_message_delivery(
    p_actor_id,p_confirmation,p_reason,p_correlation_id);
end; $$;
revoke all on function public.reset_synthetic_baseline(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reset_synthetic_baseline(uuid,text,text,text) to service_role;

revoke all on public.crm_message_delivery_events,public.operational_crm_message_evidence from public,anon,authenticated;
grant select,insert on public.crm_message_delivery_events to service_role;
grant select on public.operational_crm_message_evidence to service_role;
alter table public.crm_message_delivery_events enable row level security;
revoke all on function public.record_simulated_message_delivery(jsonb) from public,anon,authenticated;
grant execute on function public.record_simulated_message_delivery(jsonb) to service_role;

create or replace function public.apply_crm_disposition(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare actor uuid := (p_payload->>'actor_id')::uuid; item public.crm_lead_states%rowtype;
  action public.crm_disposition := (p_payload->>'disposition')::public.crm_disposition;
  next_stage public.crm_commercial_stage; existing jsonb; prior public.crm_commercial_stage;
  phone text; consent_state text; transfer public.partner_transfers%rowtype; callback timestamptz;
  side_effect text := 'none'; rule_id uuid; follow_up_id uuid; response_id uuid;
  delivery_id uuid := nullif(p_payload->>'delivery_event_id','')::uuid;
  delivery public.crm_message_delivery_events%rowtype;
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
    if p_payload->>'draft_id' is not null or p_payload->>'crm_follow_up_draft_id' is not null then
      raise exception 'approval alone is not delivery evidence' using errcode='22023';
    end if;
    if delivery_id is not null and nullif(trim(p_payload->>'external_action_reference'),'') is not null then
      raise exception 'select either simulated delivery or manual action' using errcode='22023';
    elsif delivery_id is not null then
      select * into delivery from public.crm_message_delivery_events where id=delivery_id;
      if not found or delivery.crm_lead_id<>item.id then
        raise exception 'simulated delivery does not belong to this lead' using errcode='22023';
      end if;
      if delivery.response_draft_id is not null and not exists (
        select 1 from public.response_drafts draft
        join public.processing_decisions decision on decision.id=draft.decision_id
        where draft.id=delivery.response_draft_id and draft.status='approved'
          and draft.approved_checksum=delivery.content_checksum
          and decision.source_event_id=item.source_event_id
      ) then
        raise exception 'approved intake evidence changed after delivery' using errcode='22023';
      end if;
      if delivery.crm_follow_up_draft_id is not null and not exists (
        select 1 from public.crm_follow_up_drafts draft
        where draft.id=delivery.crm_follow_up_draft_id and draft.status='approved'
          and draft.content_checksum=delivery.content_checksum and draft.crm_lead_id=item.id
      ) then
        raise exception 'approved follow-up evidence changed after delivery' using errcode='22023';
      end if;
      response_id:=delivery.response_draft_id;
      follow_up_id:=delivery.crm_follow_up_draft_id;
      side_effect:='simulated_delivery';
    elsif nullif(trim(p_payload->>'external_action_reference'),'') is not null then
      side_effect:='manual_action_recorded';
    else raise exception 'simulated delivery or manual action reference required' using errcode='22023'; end if;
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
  if action<>'Info Sent' and delivery_id is not null then
    raise exception 'delivery evidence is only valid for Info Sent' using errcode='22023';
  end if;
  select id into rule_id from public.rule_versions where active;
  update public.crm_lead_states set commercial_stage=next_stage,updated_at=now() where id=item.id;
  insert into public.crm_disposition_events(crm_lead_id,idempotency_key,disposition,actor_id,prior_stage,resulting_stage,reason,
    callback_at,timezone,draft_id,crm_follow_up_draft_id,delivery_event_id,rule_version_id,side_effect_status,external_action_reference,opt_out_recorded,correlation_id)
  values(item.id,p_payload->>'idempotency_key',action,actor,prior,next_stage,p_payload->>'reason',callback,p_payload->>'timezone',
    response_id,follow_up_id,delivery_id,rule_id,side_effect,p_payload->>'external_action_reference',
    action='No le interesa' and coalesce((p_payload->>'explicit_opt_out')::boolean,false),p_payload->>'correlation_id');
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'crm.disposition.applied',p_payload->>'correlation_id',p_payload->>'reason','succeeded',
    jsonb_build_object('lead_id',item.id,'disposition',action,'prior_stage',prior,'resulting_stage',next_stage,'side_effect_status',side_effect));
  existing:=jsonb_build_object('crm_lead_id',item.id,'disposition',action,'prior_stage',prior,'commercial_stage',next_stage,
    'side_effect_status',side_effect,'generated_draft_id',follow_up_id,'delivery_event_id',delivery_id,'partner_request_id',transfer.partner_request_id,
    'correlation_id',p_payload->>'correlation_id','replayed',false);
  update public.crm_disposition_events set result=existing where idempotency_key=p_payload->>'idempotency_key';
  return existing;
end; $$;
