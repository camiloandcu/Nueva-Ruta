-- WI-008: enrich existing fictional source cards and add immutable script versions/review.
alter table public.content_sources
  add column display_text text not null default 'Fuente ficticia para planificación de contenido.',
  add column compliance_risk text not null default 'low'
    check (compliance_risk in ('low','medium','high')),
  add column risk_reason text not null default 'Revisión sintética pendiente.';

create table public.creator_content_scripts (
  id uuid primary key,
  business_id text not null unique check (business_id ~ '^SCRIPT-[0-9]{3}$'),
  title text not null check (length(trim(title)) between 3 and 160),
  synthetic boolean not null default true check (synthetic),
  created_at timestamptz not null default '2026-09-15 17:00:00+00'
);

create table public.creator_content_script_versions (
  id uuid primary key,
  script_id uuid not null references public.creator_content_scripts(id) on delete cascade,
  version integer not null check (version > 0),
  creator_id uuid not null references public.creators(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  fit_rationale text not null check (length(trim(fit_rationale)) between 10 and 600),
  body text not null check (length(trim(body)) between 100 and 5000),
  body_checksum text not null check (body_checksum ~ '^[0-9a-f]{64}$'),
  word_count integer not null check (word_count > 0),
  estimated_duration_seconds numeric(6,2) not null check (estimated_duration_seconds > 0),
  compliance_valid boolean not null,
  compliance_codes text[] not null default '{}',
  created_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default '2026-09-15 17:00:00+00',
  unique (script_id, version)
);
create index creator_content_versions_script_idx
  on public.creator_content_script_versions(script_id, version desc);

create table public.creator_content_script_reviews (
  id uuid primary key,
  script_version_id uuid not null unique
    references public.creator_content_script_versions(id) on delete cascade,
  reviewer_id uuid not null references public.app_users(id) on delete restrict,
  decision text not null check (decision in ('approved','changes_requested','rejected')),
  reason text not null check (length(trim(reason)) between 5 and 500),
  reviewed_at timestamptz not null default '2026-09-15 17:00:00+00'
);

create function private.reject_creator_content_history_mutation()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.synthetic_reset', true), '') = 'on' then
    return old;
  end if;
  raise exception 'creator content versions and review evidence are immutable'
    using errcode = '55000';
end; $$;

create trigger creator_content_versions_immutable
before update or delete on public.creator_content_script_versions
for each row execute function private.reject_creator_content_history_mutation();
create trigger creator_content_reviews_immutable
before update or delete on public.creator_content_script_reviews
for each row execute function private.reject_creator_content_history_mutation();

create function private.seed_wi008_creator_content(p_actor_id uuid default null)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  ref constant timestamptz := '2026-09-15 17:00:00+00';
  script_a uuid := private.fixture_uuid('wi008-script-001');
  script_b uuid := private.fixture_uuid('wi008-script-002');
  script_c uuid := private.fixture_uuid('wi008-script-003');
  body_a text := 'Cuando las facturas se juntan, puede ser difícil saber qué preguntar primero. Una lista sencilla con tus cuentas y fechas quizá te ayude a ordenar la conversación, sin compartir números de cuenta por chat. Si estás explorando opciones, un consejero podría explicarte qué alternativas existen dependiendo de tu situación y de los acreedores. Cada caso es distinto; esta información no garantiza cambios en tus pagos. Si quieres, solicita información en privado y el equipo te contará cómo iniciar una conversación informativa.';
  body_b text := 'A veces escuchamos palabras parecidas para procesos distintos. Un plan de manejo de deudas no es lo mismo que consolidar o liquidar una deuda. Un consejero puede explicar qué significa cada opción y qué preguntas conviene hacer, sin decidir por ti ni prometer un resultado. La información disponible depende de tu situación y de los acreedores. Este ejemplo es educativo y ficticio, no una recomendación financiera. Si quieres conocer más, pide información en privado y conversa con el equipo sobre tus dudas.';
  body_c text := 'Ejemplo ficticio, no es un testimonio: imagina que alguien quiere prepararse para hablar de sus facturas y no sabe por dónde empezar. Puede anotar sus preguntas generales y pedir una explicación clara de los siguientes pasos. Un consejero podría revisar qué opciones existen dependiendo de la situación y de los acreedores. Cada caso es distinto y esta conversación no garantiza cambios ni resultados. Si te sirve una orientación informativa, puedes solicitarla en privado; evita compartir números de cuenta o datos sensibles por chat.';
begin
  update public.content_sources source set
    display_text=card.display_text, compliance_risk=card.risk, risk_reason=card.reason
  from (values
    ('SRC-001','Pregunta ficticia: ¿Cómo puedo organizar mis facturas antes de pedir información?','low','Pregunta educativa sin promesas ni datos personales.'),
    ('SRC-002','Objeción ficticia: No entiendo la diferencia entre un plan y otras opciones.','medium','Explicar categorías con cuidado; no dar recomendaciones individuales.'),
    ('SRC-003','Tendencia inventada: una lista visual de preguntas para una conversación informativa.','low','Formato creativo inventado; no representa una tendencia observada.'),
    ('SRC-004','Pregunta ficticia: ¿Qué hace un consejero cuando alguien solicita información?','low','Describir el rol sin prometer elegibilidad, aceptación o resultados.'),
    ('SRC-005','Objeción ficticia: Me preocupa compartir información personal por chat.','medium','Reforzar privacidad; nunca solicitar SSN, credenciales o números completos.'),
    ('SRC-006','Tendencia inventada: separar hechos, dudas y próximos pasos en una tarjeta.','low','Recurso visual ficticio, no un consejo financiero individual.'),
    ('SRC-007','Pregunta ficticia: ¿Qué significa hablar de opciones según cada situación?','medium','El lenguaje de beneficios debe ser condicional y sin cifras.'),
    ('SRC-008','Objeción ficticia de riesgo: ¿Puedo garantizar que mi deuda desaparezca?','high','Contiene una promesa prohibida como pregunta de prueba; no usar en guiones.'),
    ('SRC-009','Tendencia inventada: mitos y realidades sobre pedir información con calma.','low','Tendencia inventada; no atribuirla a publicaciones reales ni a testimonios.'),
    ('SRC-010','Pregunta ficticia: ¿Qué preguntas generales puedo preparar para un consejero?','low','Contenido educativo general; no ofrecer asesoría legal, fiscal o financiera individual.')
  ) as card(business_id,display_text,risk,reason)
  where source.business_id=card.business_id;

  insert into public.creator_content_scripts(id,business_id,title,created_at) values
    (script_a,'SCRIPT-001','Organizar preguntas sin presión',ref),
    (script_b,'SCRIPT-002','Diferenciar conceptos con claridad',ref),
    (script_c,'SCRIPT-003','Prepararse para una conversación informativa',ref)
  on conflict (business_id) do nothing;

  insert into public.creator_content_script_versions(
    id,script_id,version,creator_id,source_id,fit_rationale,body,body_checksum,word_count,
    estimated_duration_seconds,compliance_valid,compliance_codes,created_by,created_at
  )
  select item.version_id,item.script_id,1,creator.id,source.id,item.fit_rationale,item.body,
    encode(extensions.digest(item.body,'sha256'),'hex'),
    cardinality(regexp_split_to_array(trim(item.body),'\s+')),
    round(cardinality(regexp_split_to_array(trim(item.body),'\s+'))*60.0/135.0,2),
    true,'{}',p_actor_id,ref
  from (values
    (private.fixture_uuid('wi008-script-version-001'),script_a,'CR-001','SRC-001',
      'El tono calmado y práctico de Ana conecta con la fuente sobre organización de facturas.',body_a),
    (private.fixture_uuid('wi008-script-version-002'),script_b,'CR-004','SRC-002',
      'El enfoque educativo paso a paso de Diego encaja con una pregunta sobre diferencias entre conceptos.',body_b),
    (private.fixture_uuid('wi008-script-version-003'),script_c,'CR-003','SRC-010',
      'La voz empática de Sofía se ajusta a una preparación de preguntas sin presentar testimonios reales.',body_c)
  ) as item(version_id,script_id,creator_business_id,source_business_id,fit_rationale,body)
  join public.creators creator on creator.business_id=item.creator_business_id
  join public.content_sources source on source.business_id=item.source_business_id
  where source.compliance_risk <> 'high'
    and not exists(select 1 from public.creator_content_script_versions version where version.id=item.version_id);
end; $$;

create function public.creator_content_facts(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare facts jsonb;
begin
  if not exists(select 1 from public.app_users where id=p_actor_id and active and role in ('operator','supervisor','analyst')) then
    raise exception 'active creator-content role required' using errcode='42501';
  end if;
  select jsonb_build_object(
    'creators',coalesce((select jsonb_agg(jsonb_build_object(
      'id',creator.id,'business_id',creator.business_id,'fictional_name',creator.fictional_name,
      'handle',creator.handle,'platforms',creator.platforms,'audience_archetype',creator.audience_archetype,
      'voice',creator.voice,'content_pillars',creator.content_pillars,'cta_style',creator.cta_style,
      'attribution_parameters',creator.attribution_parameters,'compliance_notes',creator.compliance_notes,
      'synthetic',creator.synthetic) order by creator.business_id) from public.creators creator),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(jsonb_build_object(
      'id',source.id,'business_id',source.business_id,'source_type',source.source_type,
      'source_date',source.source_date,'channel',source.channel,'theme',source.theme,
      'provenance',source.provenance,'display_text',source.display_text,
      'compliance_risk',source.compliance_risk,'risk_reason',source.risk_reason,
      'synthetic',source.synthetic) order by source.business_id) from public.content_sources source),'[]'::jsonb),
    'leads',coalesce((select jsonb_agg(jsonb_build_object(
      'business_id',lead.business_id,'source_business_id',source.business_id,
      'creator_business_id',creator.business_id,'commercial_stage',state.commercial_stage::text,
      'received_at',lead.received_at) order by lead.business_id)
      from public.leads lead join public.crm_lead_states state on state.baseline_lead_id=lead.id
      left join public.content_sources source on source.id=lead.content_source_id
      left join public.creators creator on creator.id=lead.creator_id),'[]'::jsonb),
    'scripts',coalesce((select jsonb_agg(jsonb_build_object(
      'id',script.id,'business_id',script.business_id,'title',script.title,'synthetic',script.synthetic,
      'versions',coalesce((select jsonb_agg(jsonb_build_object(
        'id',version.id,'version',version.version,'creator_id',creator.business_id,
        'source_id',source.business_id,'fit_rationale',version.fit_rationale,'body',version.body,
        'body_checksum',version.body_checksum,'word_count',version.word_count,
        'estimated_duration_seconds',version.estimated_duration_seconds,
        'compliance_valid',version.compliance_valid,'compliance_codes',version.compliance_codes,
        'created_by',version.created_by,'created_at',version.created_at,
        'review', (select jsonb_build_object('decision',review.decision,'reason',review.reason,
          'reviewer_id',review.reviewer_id,'reviewed_at',review.reviewed_at)
          from public.creator_content_script_reviews review where review.script_version_id=version.id))
        order by version.version desc) from public.creator_content_script_versions version
        join public.creators creator on creator.id=version.creator_id
        join public.content_sources source on source.id=version.source_id
        where version.script_id=script.id),'[]'::jsonb)) order by script.business_id)
      from public.creator_content_scripts script),'[]'::jsonb)
  ) into facts;
  return facts;
end; $$;

create function public.create_creator_script_version(
  p_actor_id uuid,p_script_id uuid,p_creator_id uuid,p_source_id uuid,p_fit_rationale text,
  p_body text,p_body_checksum text,p_word_count integer,p_duration_seconds numeric
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  role_name text; next_version integer; new_id uuid := gen_random_uuid();
  script_row public.creator_content_scripts%rowtype; source_row public.content_sources%rowtype;
begin
  select role into role_name from public.app_users where id=p_actor_id and active;
  if role_name is null or role_name not in ('operator','supervisor') then
    raise exception 'active author role required' using errcode='42501';
  end if;
  select * into script_row from public.creator_content_scripts where id=p_script_id for update;
  if script_row.id is null then raise exception 'script not found' using errcode='P0002'; end if;
  select * into source_row from public.content_sources where id=p_source_id;
  if source_row.id is null or source_row.compliance_risk='high' then
    raise exception 'source unavailable for script approval' using errcode='23514';
  end if;
  if not exists(select 1 from public.creators where id=p_creator_id) then
    raise exception 'creator not found' using errcode='23503';
  end if;
  if nullif(trim(p_fit_rationale),'') is null or nullif(trim(p_body),'') is null
    or p_word_count<1 or p_duration_seconds<=0 or p_body_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'script version fields are invalid' using errcode='22023';
  end if;
  if exists(select 1 from public.creator_content_script_versions version
    where version.script_id=p_script_id and version.version=(select max(latest.version)
      from public.creator_content_script_versions latest where latest.script_id=p_script_id)
      and version.compliance_valid=false) then
    raise exception 'invalid prior script version must be replaced after compliance fixes' using errcode='23514';
  end if;
  next_version:=coalesce((select max(version) from public.creator_content_script_versions where script_id=p_script_id),0)+1;
  insert into public.creator_content_script_versions(
    id,script_id,version,creator_id,source_id,fit_rationale,body,body_checksum,word_count,
    estimated_duration_seconds,compliance_valid,compliance_codes,created_by,created_at
  ) values(new_id,p_script_id,next_version,p_creator_id,p_source_id,p_fit_rationale,p_body,p_body_checksum,
    p_word_count,p_duration_seconds,true,'{}',p_actor_id,now());
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata)
  values(p_actor_id,'creator_content.version_created','wi008-script-version-'||new_id,
    'Human-reviewed synthetic content version created','succeeded',jsonb_build_object(
      'script_id',script_row.business_id,'version',next_version,'source_id',source_row.business_id));
  return jsonb_build_object('id',new_id,'script_id',script_row.business_id,'version',next_version,
    'review_state','pending_review','compliance_valid',true);
end; $$;

create function public.review_creator_script_version(
  p_actor_id uuid,p_version_id uuid,p_decision text,p_reason text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  version_row public.creator_content_script_versions%rowtype; actor_role text; review_id uuid:=gen_random_uuid();
begin
  select role into actor_role from public.app_users where id=p_actor_id and active;
  if actor_role is distinct from 'supervisor' then raise exception 'supervisor review role required' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('approved','changes_requested','rejected')
    or nullif(trim(p_reason),'') is null or length(trim(p_reason))>500 then
    raise exception 'review decision and reason are invalid' using errcode='22023';
  end if;
  select * into version_row from public.creator_content_script_versions where id=p_version_id for update;
  if version_row.id is null then raise exception 'script version not found' using errcode='P0002'; end if;
  if version_row.version<>(select max(version) from public.creator_content_script_versions
    where script_id=version_row.script_id) then
    raise exception 'only the latest script version can be reviewed' using errcode='23514';
  end if;
  if exists(select 1 from public.creator_content_script_reviews where script_version_id=p_version_id) then
    raise exception 'script version already reviewed; create a new version for further review' using errcode='23505';
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

alter function public.reset_synthetic_baseline(uuid,text,text,text)
  rename to reset_synthetic_baseline_wi008_v1;
create function public.reset_synthetic_baseline(p_actor_id uuid,p_confirmation text,p_reason text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare counts jsonb;
begin
  counts:=public.reset_synthetic_baseline_wi008_v1(p_actor_id,p_confirmation,p_reason,p_correlation_id);
  perform private.seed_wi008_creator_content(p_actor_id);
  return counts||jsonb_build_object(
    'creators',(select count(*) from public.creators),
    'content_sources',(select count(*) from public.content_sources),
    'creator_content_scripts',(select count(*) from public.creator_content_scripts),
    'creator_content_script_versions',(select count(*) from public.creator_content_script_versions),
    'creator_content_script_reviews',(select count(*) from public.creator_content_script_reviews));
end; $$;

revoke all on public.creator_content_scripts,public.creator_content_script_versions,public.creator_content_script_reviews
  from anon,authenticated;
grant select,insert,update,delete on public.creator_content_scripts,public.creator_content_script_versions,
  public.creator_content_script_reviews to service_role;
alter table public.creator_content_scripts enable row level security;
alter table public.creator_content_script_versions enable row level security;
alter table public.creator_content_script_reviews enable row level security;

revoke all on function private.seed_wi008_creator_content(uuid) from public,anon,authenticated;
revoke all on function private.reject_creator_content_history_mutation() from public,anon,authenticated;
revoke all on function public.creator_content_facts(uuid),
  public.create_creator_script_version(uuid,uuid,uuid,uuid,text,text,text,integer,numeric),
  public.review_creator_script_version(uuid,uuid,text,text),
  public.reset_synthetic_baseline(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.creator_content_facts(uuid),
  public.create_creator_script_version(uuid,uuid,uuid,uuid,text,text,text,integer,numeric),
  public.review_creator_script_version(uuid,uuid,text,text),
  public.reset_synthetic_baseline(uuid,text,text,text) to service_role;

do $$ begin
  if (select count(*) from public.creators)=5 and (select count(*) from public.content_sources)=10 then
    perform private.seed_wi008_creator_content(null);
  end if;
end; $$;
