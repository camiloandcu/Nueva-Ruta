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
  enrollment_id text;
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
    enrollment_id:=nullif(row_item.source_values->>'partner_enrollment_id','');
    parsed_date:=case when coalesce(row_item.source_values->>'enrollment_date_raw','') ~ '^\d{4}-\d{2}-\d{2}$' then (row_item.source_values->>'enrollment_date_raw')::date else null end;
    insert into public.partner_normalized_rows(raw_row_id,normalization_version,partner_enrollment_id,partner_case_id,enrollment_date,normalized_phone,normalized_creator_id,normalized_status,quality_issues)
    values(row_item.id,'wi006-v1',enrollment_id,nullif(row_item.source_values->>'partner_case_id',''),parsed_date,normalized_phone,creator,nullif(row_item.source_values->>'status_raw',''),issue_list) on conflict do nothing;
  end loop;
  insert into public.partner_duplicate_groups(id,import_job_id,normalization_version,group_type,group_key)
  values(private.fixture_uuid(job::text||':wi006-v1:exact_duplicate:ENR-001'),job,'wi006-v1','exact_duplicate','ENR-001'),
        (private.fixture_uuid(job::text||':wi006-v1:conflicting_id:ENR-CONFLICT'),job,'wi006-v1','conflicting_id','ENR-CONFLICT') on conflict do nothing;
  insert into public.partner_duplicate_members(group_id,raw_row_id)
  select g.id,r.id from public.partner_duplicate_groups g join public.raw_partner_rows r on r.import_job_id=g.import_job_id and r.row_number=any(case when g.group_type='exact_duplicate' then array[1,2] else array[3,4] end) where g.import_job_id=job on conflict do nothing;
  for row_item in select r.*,n.partner_enrollment_id,n.quality_issues from public.raw_partner_rows r join public.partner_normalized_rows n on n.raw_row_id=r.id and n.normalization_version='wi006-v1' where r.import_job_id=job order by r.row_number loop
    if row_item.row_number in (1,2) then
      if row_item.row_number=2 then continue; end if;
      enrollment_id:='rows:1,2';
    elsif row_item.row_number in (3,4) then
      if row_item.row_number=4 then continue; end if;
      enrollment_id:='rows:3,4';
    else enrollment_id:='rows:'||row_item.row_number::text;
    end if;
    canonical_id:=private.fixture_uuid(job::text||':wi006-v1:canonical:'||enrollment_id);
    insert into public.partner_canonical_enrollments(id,import_job_id,normalization_version,canonical_key,partner_enrollment_id,canonical_values,source_row_numbers,quality_issues,conflicted)
    values(canonical_id,job,'wi006-v1',enrollment_id,case when enrollment_id='rows:3,4' then null else row_item.partner_enrollment_id end,
      case when enrollment_id='rows:3,4' then '{}'::jsonb else row_item.source_values end,case when enrollment_id='rows:1,2' then array[1,2] when enrollment_id='rows:3,4' then array[3,4] else array[row_item.row_number] end,row_item.quality_issues,enrollment_id='rows:3,4') on conflict do nothing;
    case_id:=private.fixture_uuid(canonical_id::text||':wi006-v1:case');
    insert into public.partner_reconciliation_cases(id,canonical_enrollment_id,normalization_version,status,match_method,conflict_flags,evidence,potentially_commissionable)
    values(case_id,canonical_id,'wi006-v1',case when enrollment_id='rows:3,4' or cardinality(row_item.quality_issues)>0 then 'review_required' else 'unmatched' end,null,case when enrollment_id='rows:3,4' then array['conflicting_partner_id'] else row_item.quality_issues end,
      jsonb_build_object('source_row_numbers',case when enrollment_id='rows:1,2' then array[1,2] when enrollment_id='rows:3,4' then array[3,4] else array[row_item.row_number] end,'normalization_version','wi006-v1'),false) on conflict do nothing;
  end loop;
end; $$;
