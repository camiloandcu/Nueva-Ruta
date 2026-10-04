-- Keep review authority aligned with the current version even when a newer draft exists.
create or replace function public.review_creator_script_version(
  p_actor_id uuid,p_version_id uuid,p_decision text,p_reason text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  version_row public.creator_content_script_versions%rowtype; actor_role text; review_id uuid:=gen_random_uuid();
begin
  select role into actor_role from public.app_users where id=p_actor_id and active;
  if actor_role is distinct from 'supervisor' then
    raise exception 'supervisor review role required' using errcode='42501';
  end if;
  if p_decision is null or p_decision not in ('approved','changes_requested','rejected')
    or nullif(trim(p_reason),'') is null or length(trim(p_reason))>500 then
    raise exception 'review decision and reason are invalid' using errcode='22023';
  end if;
  select * into version_row from public.creator_content_script_versions where id=p_version_id for update;
  if version_row.id is null then
    raise exception 'script version not found' using errcode='P0002';
  end if;
  if version_row.version<>(select max(version) from public.creator_content_script_versions
    where script_id=version_row.script_id) then
    raise exception 'only the latest script version can be reviewed' using errcode='23514';
  end if;
  if exists(select 1 from public.creator_content_script_reviews where script_version_id=p_version_id) then
    raise exception 'script version already reviewed; create a new version for further review'
      using errcode='23505';
  end if;
  if p_decision='approved' and not version_row.compliance_valid then
    raise exception 'noncompliant script cannot be approved' using errcode='23514';
  end if;
  if p_decision='approved' and exists(select 1 from public.content_sources
    where id=version_row.source_id and compliance_risk='high') then
    raise exception 'high-risk source cannot be approved for a script' using errcode='23514';
  end if;
  insert into public.creator_content_script_reviews(id,script_version_id,reviewer_id,decision,reason,reviewed_at)
  values(review_id,p_version_id,p_actor_id,p_decision,trim(p_reason),now());
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(p_actor_id,'creator_content.review_recorded','wi008-script-review-'||review_id,
    'Human review decision recorded','succeeded',jsonb_build_object(
      'script_version_id',p_version_id,'decision',p_decision));
  return jsonb_build_object('review_id',review_id,'script_version_id',p_version_id,'decision',p_decision);
end; $$;

revoke all on function public.review_creator_script_version(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_creator_script_version(uuid,uuid,text,text) to service_role;
