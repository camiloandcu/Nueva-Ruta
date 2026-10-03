begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select set_config('app.synthetic_reset','on',true);
delete from public.partner_reconciliation_decisions;
delete from public.partner_reconciliation_candidates;
delete from public.partner_reconciliation_cases;
delete from public.partner_canonical_enrollments;
delete from public.partner_duplicate_members;
delete from public.partner_duplicate_groups;
delete from public.partner_normalized_rows;
select set_config('app.synthetic_reset','off',true);
select private.seed_wi006_partner_analysis();
select private.seed_wi006_partner_analysis();

select is((select count(*)::integer from public.partner_normalized_rows where normalization_version='wi006-v1'),30,'synthetic fixture normalizes every immutable source row once');
select is((select count(*)::integer from public.partner_duplicate_groups where normalization_version='wi006-v1'),2,'exact duplicate and conflicting identifier groups are retained');
select is((select count(*)::integer from public.partner_reconciliation_cases where normalization_version='wi006-v1'),28,'canonical reconciliation candidates are deterministic');
select is((select count(*)::integer from public.partner_duplicate_members m join public.partner_duplicate_groups g on g.id=m.group_id where g.group_type='exact_duplicate'),2,'exact duplicate group retains both raw occurrences');
select is((select count(*)::integer from public.partner_duplicate_members m join public.partner_duplicate_groups g on g.id=m.group_id where g.group_type='conflicting_id'),2,'conflicting business ID group retains both raw occurrences');
select ok((select conflicted and partner_enrollment_id is null and canonical_values='{}'::jsonb from public.partner_canonical_enrollments where canonical_key='rows:3,4'),'conflicting source values do not select a canonical winner');
select ok((select 'ambiguous_date'=any(quality_issues) from public.partner_normalized_rows n join public.raw_partner_rows r on r.id=n.raw_row_id where r.row_number=18),'ambiguous date remains unresolved');
select ok((select 'invalid_date'=any(quality_issues) from public.partner_normalized_rows n join public.raw_partner_rows r on r.id=n.raw_row_id where r.row_number=19),'impossible date is an explicit issue');
select ok((select 'future_date'=any(quality_issues) from public.partner_normalized_rows n join public.raw_partner_rows r on r.id=n.raw_row_id where r.row_number=20),'future date is an explicit issue');
select ok((select 'missing_creator'=any(quality_issues) from public.partner_normalized_rows n join public.raw_partner_rows r on r.id=n.raw_row_id where r.row_number=11),'missing creator is an explicit issue');
select ok((select 'unknown_creator'=any(quality_issues) from public.partner_normalized_rows n join public.raw_partner_rows r on r.id=n.raw_row_id where r.row_number=13),'unknown creator is an explicit issue');
select ok((select 'contradictory_creator'=any(quality_issues) from public.partner_normalized_rows n join public.raw_partner_rows r on r.id=n.raw_row_id where r.row_number=12),'contradictory creator fixture requires review');
select ok((select 'phone_mismatch'=any(quality_issues) from public.partner_normalized_rows n join public.raw_partner_rows r on r.id=n.raw_row_id where r.row_number=9),'phone mismatch fixture is visible');
select throws_ok($$update public.raw_partner_rows set row_number=999 where row_number=1$$,'P0001','raw partner provenance is immutable','raw source rows reject mutation');
select throws_ok($$update public.partner_normalized_rows set normalized_status='overwritten' where normalization_version='wi006-v1'$$,'P0001','partner reconciliation evidence is append-only','normalized evidence rejects mutation');

select lives_ok($review$
do $$
declare reviewer uuid; target_case uuid; target_lead uuid; outcome jsonb;
begin
  select id into reviewer from public.app_users where role='analyst' and active order by id limit 1;
  select c.id into target_case from public.partner_reconciliation_cases c
    join public.partner_canonical_enrollments ce on ce.id=c.canonical_enrollment_id
    where ce.source_row_numbers=array[27]::integer[] limit 1;
  select id into target_lead from public.leads where business_id='LEAD-001';
  if reviewer is null or target_case is null or target_lead is null then raise exception 'review fixtures missing'; end if;
  outcome:=public.review_partner_reconciliation(jsonb_build_object('case_id',target_case,'actor_id',reviewer,'action','link','lead_id',target_lead,'reason','Synthetic test reviewer supplied a documented link','correlation_id','wi006-review-test'));
  if outcome->>'status'<>'matched' then raise exception 'review decision did not match'; end if;
end $$;
$review$,'authorized analyst can create a reasoned manual reconciliation link');
select is((select count(*)::integer from public.partner_reconciliation_decisions where correlation_id='wi006-review-test' and cardinality(source_row_ids)=1),1,'review decision retains actor, reason and raw provenance');
select is((select status from public.partner_reconciliation_cases where id=(select case_id from public.partner_reconciliation_decisions where correlation_id='wi006-review-test')),'matched','review decision updates the current case while preserving append-only history');
select ok(not (select potentially_commissionable from public.partner_reconciliation_cases where id=(select case_id from public.partner_reconciliation_decisions where correlation_id='wi006-review-test')),'ambiguous or quality-flagged manual link remains excluded from commission proxy');

select lives_ok($import$
do $$
declare operator_id uuid; first_result jsonb; second_result jsonb; import_payload jsonb;
begin
  select id into operator_id from public.app_users where role='operator' and active order by id limit 1;
  if operator_id is null then raise exception 'operator fixture missing'; end if;
  import_payload:=jsonb_build_object('actor_id',operator_id,'correlation_id','wi006-import-test','filename','synthetic-upload.csv','file_checksum',repeat('b',64),'synthetic',true,
    'rows',jsonb_build_array(jsonb_build_object('row_number',1,'row_checksum',repeat('c',64),'source_values',jsonb_build_object('enrollment_id','UPLOAD-1'))));
  first_result:=public.create_partner_import(import_payload);
  second_result:=public.create_partner_import(import_payload);
  if first_result->>'import_job_id'<>second_result->>'import_job_id' or second_result->>'replayed'<>'true' then raise exception 'file import was not idempotent'; end if;
end $$;
$import$,'authorized upload creates an import and duplicate submission is idempotent');
select is((select count(*)::integer from public.raw_partner_rows r join public.partner_import_jobs j on j.id=r.import_job_id where j.file_checksum=repeat('b',64)),1,'idempotent upload preserves one original row');

select lives_ok($analysis$
do $$
declare job_id uuid; operator_id uuid; lead_id uuid; payload jsonb; first_result jsonb; second_result jsonb;
begin
  select id into job_id from public.partner_import_jobs where file_checksum=repeat('b',64);
  select id into operator_id from public.app_users where role='operator' and active order by id limit 1;
  select id into lead_id from public.leads where business_id='LEAD-001';
  payload:=jsonb_build_object('import_job_id',job_id,'actor_id',operator_id,'normalization_version','wi006-rpc-test','correlation_id','wi006-analysis-test',
    'normalized_rows',jsonb_build_array(jsonb_build_object('row_number',1,'partner_enrollment_id','UPLOAD-1','partner_case_id',null,'enrollment_date','2026-09-20','phone','+15550100','creator_id','CR-001','status','enrolled','quality_issues',jsonb_build_array())),
    'duplicate_groups',jsonb_build_array(),
    'canonical_rows',jsonb_build_array(jsonb_build_object('canonical_key','rows:1','partner_enrollment_id','UPLOAD-1','canonical_values',jsonb_build_object('partner_enrollment_id','UPLOAD-1'),'source_row_numbers',jsonb_build_array(1),'quality_issues',jsonb_build_array(),'conflicted',false)),
    'reconciliation_cases',jsonb_build_array(jsonb_build_object('canonical_key','rows:1','status','matched','match_method','exact_phone','lead_id',lead_id,'candidate_lead_ids',jsonb_build_array(lead_id),'conflict_flags',jsonb_build_array(),'evidence',jsonb_build_object('match_method','exact_phone'),'potentially_commissionable',true)));
  first_result:=public.persist_partner_analysis(payload);
  second_result:=public.persist_partner_analysis(payload);
  if first_result->>'normalized_count'<>second_result->>'normalized_count' then raise exception 'processing was not idempotent'; end if;
end $$;
$analysis$,'analysis RPC atomically persists normalized, canonical, candidate and reconciliation evidence idempotently');
select ok(
  (select count(*)=1 from public.partner_normalized_rows n join public.raw_partner_rows r on r.id=n.raw_row_id join public.partner_import_jobs j on j.id=r.import_job_id where j.file_checksum=repeat('b',64) and n.normalization_version='wi006-rpc-test')
  and (select count(*)=1 from public.partner_reconciliation_cases c join public.partner_canonical_enrollments ce on ce.id=c.canonical_enrollment_id join public.partner_import_jobs j on j.id=ce.import_job_id where j.file_checksum=repeat('b',64) and c.potentially_commissionable),
  'analysis RPC stores one safe exact match without duplicating derived rows');

select lives_ok($reset$
do $$
declare supervisor_id uuid; result jsonb;
begin
  select id into supervisor_id from public.app_users where role='supervisor' and active order by id limit 1;
  result:=public.reset_synthetic_baseline(supervisor_id,'RESET SYNTHETIC BASELINE','WI-006 deterministic reset test','wi006-reset-test');
  if result->>'partner_normalized_rows'<>'30' or result->>'partner_duplicate_groups'<>'2' or result->>'partner_reconciliation_cases'<>'28' then
    raise exception 'WI-006 reset counts are inconsistent: %',result;
  end if;
end $$;
$reset$,'confirmed baseline reset recreates deterministic WI-006 fixtures');

select * from finish();
rollback;
