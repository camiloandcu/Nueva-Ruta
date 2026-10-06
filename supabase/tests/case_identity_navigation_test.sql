begin;
select plan(8);

select is((select count(*)::integer from public.crm_lead_states where business_id is null),
  0, 'every CRM state has a business label');
select is((select count(distinct business_id)::integer from public.crm_lead_states),
  (select count(*)::integer from public.crm_lead_states), 'business labels are unique');
select is((select count(*)::integer from public.crm_lead_states state
  join public.leads lead on lead.id = state.baseline_lead_id
  where state.business_id = lead.business_id),
  48, 'all seed labels remain unchanged');
select is((select count(*)::integer from public.crm_lead_states
  where business_id !~ '^LEAD-[0-9]{3,}$'),
  0, 'all labels use the LEAD-number format');
select is((select count(*)::integer from public.operational_crm_leads view
  join public.crm_lead_states state on state.id = view.id
  where view.business_id = state.business_id),
  (select count(*)::integer from public.crm_lead_states),
  'the CRM view uses persistent labels');
select is((select count(*)::integer from public.operational_redacted_leads view
  join public.crm_lead_states state on state.source_event_id = view.source_event_id
  where view.crm_lead_id = state.id and view.business_id = state.business_id),
  (select count(*)::integer from public.operational_redacted_leads),
  'intake exposes the exact linked CRM state and label');

insert into public.source_events(id, channel, source_event_id, inbound_at, source_detail,
  fictional_phone, consent_context, correlation_id)
values (gen_random_uuid(), 'organic', 'case-identity-test', now(), 'Synthetic identity test',
  '+15550199', '{"status":"granted","source":"synthetic","conversation_window_open":true}',
  'case-identity-test');

select matches((select state.business_id from public.crm_lead_states state
  join public.source_events event on event.id = state.source_event_id
  where event.source_event_id = 'case-identity-test'),
  '^LEAD-[0-9]{3,}$', 'new ingestion gets a business label from the trigger');
select is((select count(*)::integer from public.crm_lead_states state
  join public.source_events event on event.id = state.source_event_id
  where event.source_event_id = 'case-identity-test'),
  1, 'new ingestion creates exactly one CRM state');

select * from finish();
rollback;
