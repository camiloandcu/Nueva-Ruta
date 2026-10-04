begin;
select plan(23);

select has_table('public','source_events','source events exist');
select has_table('private','restricted_event_evidence','restricted evidence exists');
select has_table('public','redacted_event_evidence','redacted evidence exists');
select has_table('public','processing_decisions','decisions exist');
select has_table('public','response_drafts','drafts exist');
select has_table('public','escalations','escalations exist');
select has_table('public','ai_attempts','AI attempts exist');
select has_table('public','simulated_automatic_effects','simulated effects exist');
select has_table('public','draft_review_events','review evidence exists');
select has_view('public','operational_redacted_leads','redacted operational view exists');
select has_function('public','ingest_source_event',array['jsonb'],'transactional ingestion RPC exists');
select has_function('public','source_event_result',array['text','text'],'stable result RPC exists');
select has_function('public','review_response_draft',array['uuid','uuid','text','text','text[]','text'],'draft review RPC exists');
select col_is_unique('public','source_events',array['channel','source_event_id'],'channel and source event are unique');
select col_is_unique('public','processing_decisions','source_event_id','one decision per event');
select col_is_unique('public','response_drafts','decision_id','one draft per decision');
select col_is_unique('public','escalations',array['decision_id','reason_code'],'escalation work is idempotent');
select col_is_unique('public','simulated_automatic_effects',array['source_event_id','purpose','template_version','rule_version_id'],'automatic effects are idempotent');
select table_privs_are('private','restricted_event_evidence','service_role',array[]::text[],'service role has no direct restricted evidence access');
select table_privs_are('private','restricted_event_evidence','authenticated',array[]::text[],'authenticated has no restricted evidence access');
select lives_ok($$do $test$
declare event_id uuid:=gen_random_uuid(); decision_id uuid:=gen_random_uuid(); active_rule uuid;
begin
  select id into active_rule from public.rule_versions where active;
  insert into public.source_events(id,channel,source_event_id,inbound_at,source_detail,fictional_phone,consent_context,correlation_id,creator_id)
  values(event_id,'ctwa','pgtap-empty-fields-'||event_id,now(),'synthetic database test','+15550198','{"status":"granted"}','pgtap-empty-fields',
    (select id from public.creators where business_id='CR-001'));
  insert into public.processing_decisions(id,source_event_id,rule_version_id,decision,reason_code,safe_explanation,decision_source)
  values(decision_id,event_id,active_rule,'respond','test','synthetic test','deterministic');
  insert into public.extracted_lead_fields(decision_id,approved_fields,source) values(decision_id,'{}','deterministic');
end $test$;$$,'empty approved fields pass');
select throws_ok($$insert into public.extracted_lead_fields(decision_id,approved_fields,source) values(gen_random_uuid(),'{"ssn":"bad"}','deterministic')$$,'23514',null,'prohibited fields are rejected') from (select 1) unused;
select has_trigger('public','ai_attempts','ai_attempts_append_only','attempt evidence has an append-only guard');

select * from finish();
rollback;
