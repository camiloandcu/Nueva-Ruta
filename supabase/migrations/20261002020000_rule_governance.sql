create table public.rule_drafts (
  id uuid primary key default gen_random_uuid(),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  valid boolean not null,
  validation_issues jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_issues) = 'array'),
  source_name text not null check (length(trim(source_name)) > 0),
  created_by uuid not null,
  derived_from_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  schema_version integer not null check (schema_version > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  source_draft_id uuid unique references public.rule_drafts(id) on delete restrict,
  parent_version_id uuid references public.rule_versions(id) on delete restrict,
  derived_from_version_id uuid references public.rule_versions(id) on delete restrict,
  published_by uuid not null,
  published_at timestamptz not null default now(),
  active boolean not null default false
);

alter table public.rule_drafts
  add constraint rule_drafts_derived_version_fk
  foreign key (derived_from_version_id) references public.rule_versions(id) on delete restrict;

create unique index one_active_rule_version on public.rule_versions (active) where active;
create index rule_versions_published_at_idx on public.rule_versions (published_at desc);
create index rule_drafts_created_at_idx on public.rule_drafts (created_at desc);

create or replace function private.reject_published_rule_mutation() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.rule_publication', true), '') <> 'on' then
    raise exception 'published rule versions are immutable' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' or old.content <> new.content or old.content_hash <> new.content_hash
     or old.version <> new.version or old.published_by <> new.published_by
     or old.published_at <> new.published_at then
    raise exception 'published rule versions are immutable' using errcode = '55000';
  end if;
  return new;
end; $$;

create trigger rule_versions_immutable
before update or delete on public.rule_versions
for each row execute function private.reject_published_rule_mutation();

create or replace function public.publish_rule_draft(
  p_draft_id uuid,
  p_actor_id uuid,
  p_confirmed_hash text,
  p_reason text,
  p_correlation_id text
) returns jsonb
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  selected_draft public.rule_drafts%rowtype;
  current_version public.rule_versions%rowtype;
  published public.rule_versions%rowtype;
  next_version integer;
begin
  if not exists (
    select 1 from public.app_users
    where id = p_actor_id and role = 'supervisor' and active
  ) then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null or nullif(trim(p_correlation_id), '') is null then
    raise exception 'reason and correlation_id are required' using errcode = '22023';
  end if;

  select * into selected_draft from public.rule_drafts where id = p_draft_id for update;
  if not found then raise exception 'draft not found' using errcode = 'P0002'; end if;
  if not selected_draft.valid then raise exception 'draft is invalid' using errcode = '23514'; end if;
  if selected_draft.content_hash <> p_confirmed_hash then
    raise exception 'stale content hash confirmation' using errcode = '40001';
  end if;
  select * into current_version from public.rule_versions where active for update;
  if found and current_version.content_hash = selected_draft.content_hash then
    raise exception 'duplicate active rule content' using errcode = '23505';
  end if;

  perform set_config('app.rule_publication', 'on', true);
  update public.rule_versions set active = false where active;
  select coalesce(max(version), 0) + 1 into next_version from public.rule_versions;
  insert into public.rule_versions(
    version, schema_version, content, content_hash, source_draft_id,
    parent_version_id, derived_from_version_id, published_by, active
  ) values (
    next_version, (selected_draft.content->>'schema_version')::integer,
    selected_draft.content, selected_draft.content_hash, selected_draft.id,
    current_version.id, selected_draft.derived_from_version_id, p_actor_id, true
  ) returning * into published;
  insert into public.audit_events(actor_id, action, correlation_id, reason, outcome, safe_metadata)
  values (p_actor_id, 'rules.publish', p_correlation_id, p_reason, 'succeeded',
    jsonb_build_object('rule_version', published.version, 'content_hash', published.content_hash,
      'derived_from_version_id', published.derived_from_version_id));
  return jsonb_build_object('id', published.id, 'version', published.version,
    'content_hash', published.content_hash, 'active', published.active);
end; $$;

insert into public.rule_versions(
  id, version, schema_version, content, content_hash, published_by, published_at, active
) values (
  private.fixture_uuid('rule-version-1'), 1, 1,
  $policy${"automatic_templates":[{"body":"Recibimos tu mensaje. Un consejero podría orientarte según tu situación. Protege tu información personal.","purpose":"receipt_privacy","version":1},{"body":"Recibimos tu mensaje fuera del horario. Un consejero responderá durante el próximo horario de atención.","purpose":"after_hours","version":1},{"body":"Confirmamos tu solicitud. No enviaremos más mensajes automáticos.","purpose":"opt_out_confirmation","version":1}],"classification":{"triggers":[{"id":"explicit_debt_help","phrases":["ayuda con deudas","opciones para mis deudas"],"target_stage":"needs_review"}]},"compliance":{"allowed_automatic_purposes":["receipt_privacy","after_hours","opt_out_confirmation"],"conditional_phrases":["podría","en algunos casos","dependiendo de la situación y de los acreedores"],"disallowed_partner_terms":["asesor","consultor","especialista"],"prohibited_phrases":["garantizamos","garantía","deja de pagar","no hables con tus acreedores","tu deuda desaparecerá"],"required_partner_term":"consejero"},"debt_policy":{"currency":"USD","maximum":100000,"minimum":5000,"supported_types":["credit_card","medical","personal_loan"]},"escalation":{"sla_minutes":30},"feature_flags":{"automatic_messages_enabled":false},"operating_schedule":{"closes_at":"18:00:00","opens_at":"09:00:00","timezone":"America/New_York","weekdays":["monday","tuesday","wednesday","thursday","friday"]},"policy_id":"nueva-ruta-fictional-defaults","retry_policy":{"delays_minutes":[5,30,120],"maximum_attempts":3},"schema_version":1,"stage_transitions":{"ignored":[],"needs_review":["qualified","ignored"],"qualified":[],"received":["needs_review","ignored"]},"state_coverage":{"included":["CA","FL","TX"]}}$policy$::jsonb,
  'b229bf8f6e7c8e55deed9975b5d5ca2a88bf664783aefa5586906dc74aae71e4',
  private.fixture_uuid('rule-system-actor'), '2026-09-15 17:00:00+00', true
);

revoke all on public.rule_drafts, public.rule_versions from anon, authenticated;
grant select, insert, update, delete on public.rule_drafts, public.rule_versions to service_role;
revoke all on function public.publish_rule_draft(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.publish_rule_draft(uuid, uuid, text, text, text) to service_role;
revoke all on function private.reject_published_rule_mutation() from public;
alter table public.rule_drafts enable row level security;
alter table public.rule_versions enable row level security;
