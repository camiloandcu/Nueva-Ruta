-- Keep the prequalified fixture's stage-entry timestamp aligned with its reportable age.
alter function public.reset_synthetic_baseline(uuid,text,text,text)
  rename to reset_synthetic_baseline_wi007_v1;

create function public.reset_synthetic_baseline(p_actor_id uuid,p_confirmation text,p_reason text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare counts jsonb;
begin
  counts:=public.reset_synthetic_baseline_wi007_v1(p_actor_id,p_confirmation,p_reason,p_correlation_id);
  update public.crm_lead_states state set qualified_at=state.updated_at
  from public.leads lead
  where lead.id=state.baseline_lead_id and lead.business_id in ('LEAD-017','LEAD-018','LEAD-019');
  return counts;
end; $$;

revoke all on function public.reset_synthetic_baseline(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reset_synthetic_baseline(uuid,text,text,text) to service_role;
