-- CRM state IDs remain immutable keys. Business IDs are stable operator labels.
create sequence public.crm_lead_business_number_seq start with 49;

alter table public.crm_lead_states add column business_id text;

update public.crm_lead_states state
set business_id = lead.business_id
from public.leads lead
where state.baseline_lead_id = lead.id;

with numbered as (
  select id, row_number() over (order by created_at, id) + 48 as number
  from public.crm_lead_states
  where source_event_id is not null and business_id is null
)
update public.crm_lead_states state
set business_id = 'LEAD-' || lpad(numbered.number::text, 3, '0')
from numbered where state.id = numbered.id;

select setval(
  'public.crm_lead_business_number_seq',
  greatest(48, (select max(substring(business_id from '^LEAD-([0-9]+)$')::bigint)
                from public.crm_lead_states)),
  true
);

alter table public.crm_lead_states alter column business_id set not null;
alter table public.crm_lead_states add constraint crm_lead_states_business_id_key unique (business_id);
alter table public.crm_lead_states add constraint crm_lead_business_id_format
  check (business_id ~ '^LEAD-[0-9]{3,}$');

create function private.assign_crm_business_id() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.baseline_lead_id is not null then
    select business_id into new.business_id from public.leads where id = new.baseline_lead_id;
  else
    new.business_id := 'LEAD-' || lpad(nextval('public.crm_lead_business_number_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;
create trigger crm_lead_business_id before insert on public.crm_lead_states
for each row execute function private.assign_crm_business_id();

create or replace view public.operational_crm_leads as
select state.id, state.business_id,
  coalesce(lead.fictional_phone, event.fictional_phone) as fictional_phone,
  coalesce(lead.received_at, event.inbound_at) as received_at,
  coalesce(lead.initial_status::text, decision.decision::text, 'received') as initial_status,
  state.commercial_stage::text as commercial_stage, state.baseline_lead_id, state.source_event_id,
  redacted.redacted_body, redacted.redaction_types,
  (consent.status = 'withdrawn' or event.consent_context->>'status' = 'withdrawn' or state.opted_out_at is not null) as opted_out,
  state.updated_at
from public.crm_lead_states state
left join public.leads lead on lead.id = state.baseline_lead_id
left join public.source_events event on event.id = state.source_event_id
left join public.processing_decisions decision on decision.source_event_id = event.id
left join public.redacted_event_evidence redacted on redacted.source_event_id = event.id
left join public.consent_evidence consent on consent.lead_id = lead.id;

create or replace view public.operational_redacted_leads as
select se.id as source_event_id, se.channel, se.source_event_id as external_event_id,
  se.inbound_at as received_at, se.source_detail, se.fictional_phone, se.correlation_id,
  re.redacted_body, re.redaction_types, pd.id as decision_id, pd.decision, pd.reason_code,
  state.id as crm_lead_id, state.business_id
from public.source_events se
join public.redacted_event_evidence re on re.source_event_id = se.id
join public.processing_decisions pd on pd.source_event_id = se.id
join public.crm_lead_states state on state.source_event_id = se.id;
