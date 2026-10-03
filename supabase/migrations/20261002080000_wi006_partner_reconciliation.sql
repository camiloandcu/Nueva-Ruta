create table public.partner_normalized_rows (
  id uuid primary key default gen_random_uuid(),
  raw_row_id uuid not null references public.raw_partner_rows(id) on delete restrict,
  normalization_version text not null,
  partner_enrollment_id text,
  partner_case_id text,
  enrollment_date date,
  normalized_phone text,
  normalized_creator_id text,
  normalized_status text,
  quality_issues text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(raw_row_id, normalization_version)
);

create table public.partner_duplicate_groups (
  id uuid primary key,
  import_job_id uuid not null references public.partner_import_jobs(id) on delete restrict,
  normalization_version text not null,
  group_type text not null check (group_type in ('exact_duplicate','conflicting_id')),
  group_key text not null,
  created_at timestamptz not null default now(),
  unique(import_job_id, normalization_version, group_type, group_key)
);
create table public.partner_duplicate_members (
  group_id uuid not null references public.partner_duplicate_groups(id) on delete restrict,
  raw_row_id uuid not null references public.raw_partner_rows(id) on delete restrict,
  primary key(group_id, raw_row_id)
);

create table public.partner_canonical_enrollments (
  id uuid primary key,
  import_job_id uuid not null references public.partner_import_jobs(id) on delete restrict,
  normalization_version text not null,
  canonical_key text not null,
  partner_enrollment_id text,
  canonical_values jsonb not null check (jsonb_typeof(canonical_values)='object'),
  source_row_numbers integer[] not null check (cardinality(source_row_numbers)>0),
  quality_issues text[] not null default '{}',
  conflicted boolean not null default false,
  created_at timestamptz not null default now(),
  unique(import_job_id, normalization_version, canonical_key)
);

create table public.partner_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  canonical_enrollment_id uuid not null references public.partner_canonical_enrollments(id) on delete restrict,
  normalization_version text not null,
  status text not null check (status in ('matched','review_required','unmatched','rejected')),
  match_method text check (match_method in ('exact_external_id','exact_phone')),
  lead_id uuid references public.leads(id) on delete restrict,
  candidate_lead_ids uuid[] not null default '{}',
  conflict_flags text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  potentially_commissionable boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(canonical_enrollment_id, normalization_version),
  check (not potentially_commissionable or (status='matched' and lead_id is not null and cardinality(conflict_flags)=0))
);
create index partner_reconciliation_queue_idx on public.partner_reconciliation_cases(status, updated_at);

create table public.partner_reconciliation_candidates (
  case_id uuid not null references public.partner_reconciliation_cases(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  match_method text not null check (match_method in ('exact_external_id','exact_phone','manual_link')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  primary key(case_id, lead_id)
);

create table public.partner_reconciliation_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.partner_reconciliation_cases(id) on delete restrict,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  action text not null check (action in ('accept','reject','link')),
  reason text not null check (length(trim(reason))>0),
  prior_status text not null,
  resulting_status text not null check (resulting_status in ('matched','rejected')),
  lead_id uuid references public.leads(id) on delete restrict,
  source_row_ids uuid[] not null check (cardinality(source_row_ids)>0),
  evidence_snapshot jsonb not null check (jsonb_typeof(evidence_snapshot)='object'),
  correlation_id text not null,
  created_at timestamptz not null default now(),
  check ((action='reject' and resulting_status='rejected' and lead_id is null) or
         (action in ('accept','link') and resulting_status='matched' and lead_id is not null))
);
create index partner_reconciliation_decisions_case_idx on public.partner_reconciliation_decisions(case_id, created_at desc);

create or replace function private.reject_partner_derived_mutation() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.synthetic_reset', true), '') <> 'on' then
    raise exception 'partner reconciliation evidence is append-only';
  end if;
  return old;
end; $$;
create trigger partner_normalized_rows_immutable before update or delete on public.partner_normalized_rows
for each row execute function private.reject_partner_derived_mutation();
create trigger partner_duplicate_groups_immutable before update or delete on public.partner_duplicate_groups
for each row execute function private.reject_partner_derived_mutation();
create trigger partner_duplicate_members_immutable before update or delete on public.partner_duplicate_members
for each row execute function private.reject_partner_derived_mutation();
create trigger partner_canonical_enrollments_immutable before update or delete on public.partner_canonical_enrollments
for each row execute function private.reject_partner_derived_mutation();
create trigger partner_reconciliation_candidates_immutable before update or delete on public.partner_reconciliation_candidates
for each row execute function private.reject_partner_derived_mutation();
create trigger partner_reconciliation_decisions_immutable before update or delete on public.partner_reconciliation_decisions
for each row execute function private.reject_partner_derived_mutation();

alter table public.raw_partner_rows drop constraint raw_partner_rows_row_checksum_check;
alter table public.raw_partner_rows add constraint raw_partner_rows_row_checksum_check
  check (row_checksum ~ '^([0-9a-f]{32}|[0-9a-f]{64})$');
create unique index partner_import_file_checksum_unique on public.partner_import_jobs(file_checksum);

create or replace function public.create_partner_import(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  job_id uuid;
  existing public.partner_import_jobs%rowtype;
  item jsonb;
  result jsonb;
begin
  if nullif(p_payload->>'actor_id','') is null or not exists(
    select 1 from public.app_users where id=(p_payload->>'actor_id')::uuid and role in ('operator','supervisor') and active
  ) then raise exception 'operator role required' using errcode='42501'; end if;
  if p_payload->>'synthetic' <> 'true' then raise exception 'synthetic-only import required' using errcode='22023'; end if;
  if length(coalesce(p_payload->>'file_checksum',''))<>64 or jsonb_typeof(p_payload->'rows')<>'array' then
    raise exception 'invalid partner import payload' using errcode='22023';
  end if;
  select * into existing from public.partner_import_jobs where file_checksum=p_payload->>'file_checksum';
  if found then
    return jsonb_build_object('import_job_id',existing.id,'business_id',existing.business_id,'file_checksum',existing.file_checksum,'row_count',(select count(*) from public.raw_partner_rows where import_job_id=existing.id),'replayed',true);
  end if;
  job_id := gen_random_uuid();
  insert into public.partner_import_jobs(id,business_id,filename,file_checksum,imported_at,synthetic)
  values(job_id,'UPLOAD-'||substr(p_payload->>'file_checksum',1,24),p_payload->>'filename',p_payload->>'file_checksum',now(),true);
  for item in select value from jsonb_array_elements(p_payload->'rows') loop
    insert into public.raw_partner_rows(id,import_job_id,row_number,row_checksum,source_values,defect_tags,synthetic)
    values(gen_random_uuid(),job_id,(item->>'row_number')::integer,item->>'row_checksum',item->'source_values',array['csv_import'],true);
  end loop;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values((p_payload->>'actor_id')::uuid,'partner.import.created',p_payload->>'correlation_id','Synthetic partner CSV imported','succeeded',jsonb_build_object('import_job_id',job_id,'row_count',jsonb_array_length(p_payload->'rows'),'file_checksum',p_payload->>'file_checksum'));
  select jsonb_build_object('import_job_id',job_id,'business_id','UPLOAD-'||substr(p_payload->>'file_checksum',1,24),'file_checksum',p_payload->>'file_checksum','row_count',count(*),'replayed',false)
    into result from public.raw_partner_rows where import_job_id=job_id;
  return result;
end; $$;

create or replace function public.persist_partner_analysis(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  job_id uuid := (p_payload->>'import_job_id')::uuid;
  version text := p_payload->>'normalization_version';
  actor uuid := (p_payload->>'actor_id')::uuid;
  item jsonb;
  raw_id uuid;
  group_id uuid;
  canonical_id uuid;
  case_id uuid;
  candidate uuid;
  source_ids uuid[];
  outcome jsonb;
begin
  if actor is not null and not exists(select 1 from public.app_users where id=actor and active) then
    raise exception 'active application role required' using errcode='42501';
  end if;
  if not exists(select 1 from public.partner_import_jobs where id=job_id) then raise exception 'import job not found' using errcode='P0002'; end if;

  for item in select value from jsonb_array_elements(coalesce(p_payload->'normalized_rows','[]'::jsonb)) loop
    select id into raw_id from public.raw_partner_rows where import_job_id=job_id and row_number=(item->>'row_number')::integer;
    if raw_id is null then raise exception 'source row not found' using errcode='22023'; end if;
    insert into public.partner_normalized_rows(raw_row_id,normalization_version,partner_enrollment_id,partner_case_id,enrollment_date,normalized_phone,normalized_creator_id,normalized_status,quality_issues)
    values(raw_id,version,nullif(item->>'partner_enrollment_id',''),nullif(item->>'partner_case_id',''),nullif(item->>'enrollment_date','')::date,nullif(item->>'phone',''),nullif(item->>'creator_id',''),nullif(item->>'status',''),array(select jsonb_array_elements_text(item->'quality_issues')))
    on conflict(raw_row_id,normalization_version) do nothing;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_payload->'duplicate_groups','[]'::jsonb)) loop
    group_id := private.fixture_uuid(job_id::text||':'||version||':'||(item->>'group_type')||':'||(item->>'group_key'));
    insert into public.partner_duplicate_groups(id,import_job_id,normalization_version,group_type,group_key)
    values(group_id,job_id,version,item->>'group_type',item->>'group_key') on conflict do nothing;
    for raw_id in select r.id from public.raw_partner_rows r where r.import_job_id=job_id and r.row_number in (select value::integer from jsonb_array_elements_text(item->'row_numbers')) loop
      insert into public.partner_duplicate_members(group_id,raw_row_id) values(group_id,raw_id) on conflict do nothing;
    end loop;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_payload->'canonical_rows','[]'::jsonb)) loop
    canonical_id := private.fixture_uuid(job_id::text||':'||version||':canonical:'||(item->>'canonical_key'));
    insert into public.partner_canonical_enrollments(id,import_job_id,normalization_version,canonical_key,partner_enrollment_id,canonical_values,source_row_numbers,quality_issues,conflicted)
    values(canonical_id,job_id,version,item->>'canonical_key',nullif(item->>'partner_enrollment_id',''),item->'canonical_values',array(select value::integer from jsonb_array_elements_text(item->'source_row_numbers')),array(select jsonb_array_elements_text(item->'quality_issues')),coalesce((item->>'conflicted')::boolean,false))
    on conflict(import_job_id,normalization_version,canonical_key) do nothing;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_payload->'reconciliation_cases','[]'::jsonb)) loop
    canonical_id := private.fixture_uuid(job_id::text||':'||version||':canonical:'||(item->>'canonical_key'));
    case_id := private.fixture_uuid(canonical_id::text||':'||version||':case');
    insert into public.partner_reconciliation_cases(id,canonical_enrollment_id,normalization_version,status,match_method,lead_id,candidate_lead_ids,conflict_flags,evidence,potentially_commissionable)
    values(case_id,canonical_id,version,item->>'status',nullif(item->>'match_method',''),nullif(item->>'lead_id','')::uuid,array(select value::uuid from jsonb_array_elements_text(item->'candidate_lead_ids')),array(select jsonb_array_elements_text(item->'conflict_flags')),item->'evidence',coalesce((item->>'potentially_commissionable')::boolean,false))
    on conflict(canonical_enrollment_id,normalization_version) do nothing;
    select id into case_id from public.partner_reconciliation_cases where canonical_enrollment_id=canonical_id and normalization_version=version;
    for candidate in select value::uuid from jsonb_array_elements_text(item->'candidate_lead_ids') loop
      insert into public.partner_reconciliation_candidates(case_id,lead_id,match_method,evidence)
      values(case_id,candidate,coalesce(nullif(item->>'candidate_method',''),nullif(item->>'match_method',''),'exact_phone'),item->'evidence') on conflict do nothing;
    end loop;
  end loop;
  if actor is not null then
    insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
    values(actor,'partner.import.analyzed',coalesce(p_payload->>'correlation_id','wi006-analysis'),'Deterministic partner normalization and reconciliation completed','succeeded',jsonb_build_object('import_job_id',job_id,'normalization_version',version));
  end if;
  select jsonb_build_object('import_job_id',job_id,'normalization_version',version,'normalized_count',(select count(*) from public.partner_normalized_rows where normalization_version=version and raw_row_id in (select id from public.raw_partner_rows where import_job_id=job_id)),'case_count',(select count(*) from public.partner_reconciliation_cases c join public.partner_canonical_enrollments ce on ce.id=c.canonical_enrollment_id where ce.import_job_id=job_id and c.normalization_version=version)) into outcome;
  return outcome;
end; $$;

create or replace function public.review_partner_reconciliation(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  actor uuid := (p_payload->>'actor_id')::uuid;
  item public.partner_reconciliation_cases%rowtype;
  canonical public.partner_canonical_enrollments%rowtype;
  decision_action text := p_payload->>'action';
  chosen_lead uuid;
  resulting_status text;
  sources uuid[];
begin
  if not exists(select 1 from public.app_users where id=actor and role in ('analyst','supervisor') and active) then raise exception 'analyst role required' using errcode='42501'; end if;
  if nullif(trim(p_payload->>'reason'),'') is null or length(p_payload->>'reason')>500 or nullif(p_payload->>'correlation_id','') is null then raise exception 'reason and correlation_id are required' using errcode='22023'; end if;
  select * into item from public.partner_reconciliation_cases where id=(p_payload->>'case_id')::uuid for update;
  if not found then raise exception 'reconciliation case not found' using errcode='P0002'; end if;
  select * into canonical from public.partner_canonical_enrollments where id=item.canonical_enrollment_id;
  if decision_action not in ('accept','reject','link') then raise exception 'unsupported review action' using errcode='22023'; end if;
  if decision_action='reject' then
    resulting_status := 'rejected'; chosen_lead := null;
  else
    chosen_lead := coalesce(nullif(p_payload->>'lead_id','')::uuid,item.lead_id);
    if chosen_lead is null and cardinality(item.candidate_lead_ids)=1 then chosen_lead := item.candidate_lead_ids[1]; end if;
    if chosen_lead is null or not exists(select 1 from public.leads where id=chosen_lead) then raise exception 'a valid lead link is required' using errcode='22023'; end if;
    if decision_action='accept' and not (chosen_lead=any(item.candidate_lead_ids)) then raise exception 'accept must select an automatic candidate; use link for a new candidate' using errcode='22023'; end if;
    resulting_status := 'matched';
  end if;
  select array_agg(r.id order by r.row_number) into sources from public.raw_partner_rows r where r.import_job_id=canonical.import_job_id and r.row_number=any(canonical.source_row_numbers);
  insert into public.partner_reconciliation_decisions(case_id,actor_id,action,reason,prior_status,resulting_status,lead_id,source_row_ids,evidence_snapshot,correlation_id)
  values(item.id,actor,decision_action,p_payload->>'reason',item.status,resulting_status,chosen_lead,sources,item.evidence,p_payload->>'correlation_id');
  update public.partner_reconciliation_cases set status=resulting_status,lead_id=chosen_lead,
    potentially_commissionable=(resulting_status='matched' and cardinality(item.conflict_flags)=0 and cardinality(canonical.quality_issues)=0 and not canonical.conflicted),updated_at=now()
  where id=item.id;
  if decision_action='link' and chosen_lead is not null then
    insert into public.partner_reconciliation_candidates(case_id,lead_id,match_method,evidence)
    values(item.id,chosen_lead,'manual_link',jsonb_build_object('reason',p_payload->>'reason')) on conflict do nothing;
  end if;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'partner.reconciliation.reviewed',p_payload->>'correlation_id',p_payload->>'reason','succeeded',jsonb_build_object('case_id',item.id,'action',decision_action,'lead_id',chosen_lead));
  return jsonb_build_object('case_id',item.id,'status',resulting_status,'lead_id',chosen_lead,'potentially_commissionable',(resulting_status='matched' and cardinality(item.conflict_flags)=0 and cardinality(canonical.quality_issues)=0 and not canonical.conflicted));
end; $$;

create or replace function private.seed_wi006_partner_analysis()
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  job uuid := private.fixture_uuid('partner-import-1');
  row_item record;
  phone_digits text;
  parsed_date date;
  issue_list text[];
  normalized_phone text;
  creator text;
  enr_id text;
  canonical_id uuid;
  case_id uuid;
begin
  for row_item in select r.* from public.raw_partner_rows r where r.import_job_id=job order by r.row_number loop
    phone_digits := regexp_replace(coalesce(row_item.source_values->>'phone_raw',''), '\D', '', 'g');
    normalized_phone := case when length(phone_digits)=7 and phone_digits like '55501%' then '+1'||phone_digits when length(phone_digits)=8 and phone_digits like '155501%' then '+'||phone_digits when length(phone_digits)=10 then '+1'||phone_digits when length(phone_digits)=11 and left(phone_digits,1)='1' then '+'||phone_digits else null end;
    creator := nullif(upper(trim(coalesce(row_item.source_values->>'creator_id_raw',''))),'');
    issue_list := array[]::text[];
    if normalized_phone is null then issue_list:=array_append(issue_list,'invalid_phone'); end if;
    if creator is null then issue_list:=array_append(issue_list,'missing_creator'); elsif creator not in ('CR-001','CR-002','CR-003','CR-004','CR-005') then issue_list:=array_append(issue_list,'unknown_creator'); end if;
    if coalesce(row_item.source_values->>'enrollment_date_raw','')='' then issue_list:=array_append(issue_list,'missing_date');
    elsif row_item.row_number=18 then issue_list:=array_append(issue_list,'ambiguous_date');
    elsif row_item.row_number=19 then issue_list:=array_append(issue_list,'invalid_date');
    elsif row_item.row_number=20 then issue_list:=array_append(issue_list,'future_date');
    end if;
    select issue_list || coalesce(array_agg(tag),array[]::text[]) into issue_list
    from unnest(row_item.defect_tags) tag
    where tag in ('ambiguous_link','conflicting_id','contradictory_creator','date_quality','missing_creator','phone_mismatch','repeated_enrollment','unmatched_phone','unknown_creator');
    enr_id:=nullif(row_item.source_values->>'partner_enrollment_id','');
    parsed_date:=case when coalesce(row_item.source_values->>'enrollment_date_raw','') ~ '^\d{4}-\d{2}-\d{2}$' then (row_item.source_values->>'enrollment_date_raw')::date else null end;
    insert into public.partner_normalized_rows(raw_row_id,normalization_version,partner_enrollment_id,partner_case_id,enrollment_date,normalized_phone,normalized_creator_id,normalized_status,quality_issues)
    values(row_item.id,'wi006-v1',enr_id,nullif(row_item.source_values->>'partner_case_id',''),parsed_date,normalized_phone,creator,nullif(row_item.source_values->>'status_raw',''),issue_list) on conflict do nothing;
  end loop;
  insert into public.partner_duplicate_groups(id,import_job_id,normalization_version,group_type,group_key)
  values(private.fixture_uuid(job::text||':wi006-v1:exact_duplicate:ENR-001'),job,'wi006-v1','exact_duplicate','ENR-001'),
        (private.fixture_uuid(job::text||':wi006-v1:conflicting_id:ENR-CONFLICT'),job,'wi006-v1','conflicting_id','ENR-CONFLICT') on conflict do nothing;
  insert into public.partner_duplicate_members(group_id,raw_row_id)
  select g.id,r.id from public.partner_duplicate_groups g join public.raw_partner_rows r on r.import_job_id=g.import_job_id and r.row_number=any(case when g.group_type='exact_duplicate' then array[1,2] else array[3,4] end) where g.import_job_id=job on conflict do nothing;
  for row_item in select r.*,n.partner_enrollment_id,n.quality_issues from public.raw_partner_rows r join public.partner_normalized_rows n on n.raw_row_id=r.id and n.normalization_version='wi006-v1' where r.import_job_id=job order by r.row_number loop
    if row_item.row_number in (1,2) then
      if row_item.row_number=2 then continue; end if;
      enr_id:='rows:1,2';
    elsif row_item.row_number in (3,4) then
      if row_item.row_number=4 then continue; end if;
      enr_id:='rows:3,4';
    else enr_id:='rows:'||row_item.row_number::text;
    end if;
    canonical_id:=private.fixture_uuid(job::text||':wi006-v1:canonical:'||enr_id);
    insert into public.partner_canonical_enrollments(id,import_job_id,normalization_version,canonical_key,partner_enrollment_id,canonical_values,source_row_numbers,quality_issues,conflicted)
    values(canonical_id,job,'wi006-v1',enr_id,case when enr_id='rows:3,4' then null else row_item.partner_enrollment_id end,
      case when enr_id='rows:3,4' then '{}'::jsonb else row_item.source_values end,case when enr_id='rows:1,2' then array[1,2] when enr_id='rows:3,4' then array[3,4] else array[row_item.row_number] end,row_item.quality_issues,enr_id='rows:3,4') on conflict do nothing;
    case_id:=private.fixture_uuid(canonical_id::text||':wi006-v1:case');
    insert into public.partner_reconciliation_cases(id,canonical_enrollment_id,normalization_version,status,match_method,conflict_flags,evidence,potentially_commissionable)
    values(case_id,canonical_id,'wi006-v1',case when enr_id='rows:3,4' or cardinality(row_item.quality_issues)>0 then 'review_required' else 'unmatched' end,null,case when enr_id='rows:3,4' then array['conflicting_partner_id'] else row_item.quality_issues end,
      jsonb_build_object('source_row_numbers',case when enr_id='rows:1,2' then array[1,2] when enr_id='rows:3,4' then array[3,4] else array[row_item.row_number] end,'normalization_version','wi006-v1'),false) on conflict do nothing;
  end loop;
end; $$;

alter function public.reset_synthetic_baseline(uuid,text,text,text) rename to reset_synthetic_baseline_wi005;
create function public.reset_synthetic_baseline(p_actor_id uuid,p_confirmation text,p_reason text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare counts jsonb;
begin
  perform set_config('app.synthetic_reset','on',true);
  delete from public.partner_reconciliation_decisions;
  delete from public.partner_reconciliation_candidates;
  delete from public.partner_reconciliation_cases;
  delete from public.partner_canonical_enrollments;
  delete from public.partner_duplicate_members;
  delete from public.partner_duplicate_groups;
  delete from public.partner_normalized_rows;
  counts:=public.reset_synthetic_baseline_wi005(p_actor_id,p_confirmation,p_reason,p_correlation_id);
  perform private.seed_wi006_partner_analysis();
  counts:=counts||jsonb_build_object('partner_normalized_rows',(select count(*) from public.partner_normalized_rows),'partner_duplicate_groups',(select count(*) from public.partner_duplicate_groups),'partner_reconciliation_cases',(select count(*) from public.partner_reconciliation_cases));
  return counts;
end; $$;

revoke all on function public.create_partner_import(jsonb) from public,anon,authenticated;
revoke all on function public.persist_partner_analysis(jsonb) from public,anon,authenticated;
revoke all on function public.review_partner_reconciliation(jsonb) from public,anon,authenticated;
revoke all on function private.seed_wi006_partner_analysis() from public,anon,authenticated;
revoke all on function public.reset_synthetic_baseline(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_partner_import(jsonb) to service_role;
grant execute on function public.persist_partner_analysis(jsonb) to service_role;
grant execute on function public.review_partner_reconciliation(jsonb) to service_role;
grant execute on function public.reset_synthetic_baseline(uuid,text,text,text) to service_role;

alter table public.partner_normalized_rows enable row level security;
alter table public.partner_duplicate_groups enable row level security;
alter table public.partner_duplicate_members enable row level security;
alter table public.partner_canonical_enrollments enable row level security;
alter table public.partner_reconciliation_cases enable row level security;
alter table public.partner_reconciliation_candidates enable row level security;
alter table public.partner_reconciliation_decisions enable row level security;
grant select,insert,update,delete on public.partner_normalized_rows,public.partner_duplicate_groups,public.partner_duplicate_members,public.partner_canonical_enrollments,public.partner_reconciliation_cases,public.partner_reconciliation_candidates,public.partner_reconciliation_decisions to service_role;
