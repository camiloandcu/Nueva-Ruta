create or replace function public.approve_crm_follow_up_draft(p_payload jsonb) returns jsonb
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
  if nullif(p_payload->>'content','') is null or p_payload->>'content_checksum' !~ '^[0-9a-f]{64}$' then
    raise exception 'validated draft content and checksum required' using errcode='22023';
  end if;
  update public.crm_follow_up_drafts set status='approved',content=p_payload->>'content',
    content_checksum=p_payload->>'content_checksum',approved_by=actor,approved_at=now() where id=draft.id;
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(actor,'crm.follow_up_draft.approved',p_payload->>'correlation_id',p_payload->>'reason','succeeded',
    jsonb_build_object('draft_id',draft.id,'crm_lead_id',draft.crm_lead_id,'checksum',p_payload->>'content_checksum'));
  return jsonb_build_object('draft_id',draft.id,'status','approved','checksum',p_payload->>'content_checksum','replayed',false);
end; $$;
