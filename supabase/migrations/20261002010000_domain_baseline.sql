create type public.app_role as enum ('operator', 'supervisor', 'analyst');
create type public.lead_channel as enum ('ctwa', 'organic');
create type public.lead_status as enum ('received', 'needs_review', 'ignored');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.consent_status as enum ('granted', 'withdrawn', 'unknown');
create schema if not exists private;

create or replace function private.fixture_uuid(value text) returns uuid
language sql immutable strict as $$
  select (substr(md5(value),1,8)||'-'||substr(md5(value),9,4)||'-'||substr(md5(value),13,4)||'-'||substr(md5(value),17,4)||'-'||substr(md5(value),21,12))::uuid;
$$;

create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)), display_name text not null check (length(trim(display_name)) > 0),
  role public.app_role not null, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.creators (
  id uuid primary key, business_id text not null unique check (business_id ~ '^CR-[0-9]{3}$'), fictional_name text not null,
  handle text not null unique check (handle like '@%'), platforms text[] not null check (cardinality(platforms)>0),
  audience_archetype text not null, voice text not null, content_pillars text[] not null check (cardinality(content_pillars)>0),
  cta_style text not null, attribution_parameters jsonb not null check (jsonb_typeof(attribution_parameters)='object'),
  compliance_notes text not null, synthetic boolean not null default true check (synthetic), created_at timestamptz not null
);
create table public.content_sources (
  id uuid primary key, business_id text not null unique check (business_id ~ '^SRC-[0-9]{3}$'),
  source_type text not null check (source_type in ('fictional_question','fictional_objection','invented_trend')),
  source_date date not null, channel text not null check (channel in ('instagram','tiktok','youtube','direct')),
  theme text not null, provenance text not null check (provenance='synthetic_fictional'), synthetic boolean not null default true check (synthetic)
);
create table public.leads (
  id uuid primary key, business_id text not null unique check (business_id ~ '^LEAD-[0-9]{3}$'),
  creator_id uuid references public.creators(id) on delete restrict, content_source_id uuid references public.content_sources(id) on delete restrict,
  source_event_id text not null unique, received_at timestamptz not null,
  reference_instant timestamptz not null check (reference_instant='2026-09-15 17:00:00+00'::timestamptz),
  channel public.lead_channel not null, source_detail text not null,
  fictional_phone text not null unique check (fictional_phone ~ '^\+155501[0-9]{2}$'),
  initial_status public.lead_status not null, case_tags text[] not null check (cardinality(case_tags)>0),
  synthetic boolean not null default true check (synthetic),
  check ((channel='organic' and creator_id is null) or channel='ctwa'), check (received_at<=reference_instant)
);
create index leads_creator_received_idx on public.leads (creator_id,received_at desc);
create index leads_case_tags_idx on public.leads using gin (case_tags);
create table public.messages (
  id uuid primary key, lead_id uuid not null references public.leads(id) on delete cascade, source_message_id text not null unique,
  direction public.message_direction not null, body text not null check (length(trim(body))>0), sent_at timestamptz not null,
  synthetic boolean not null default true check (synthetic)
);
create index messages_lead_sent_idx on public.messages (lead_id,sent_at);
create table public.consent_evidence (
  id uuid primary key, lead_id uuid not null unique references public.leads(id) on delete cascade, status public.consent_status not null,
  source text not null, captured_at timestamptz not null, conversation_window_open boolean not null,
  synthetic boolean not null default true check (synthetic)
);
create table public.partner_import_jobs (
  id uuid primary key, business_id text not null unique, filename text not null,
  file_checksum text not null check (file_checksum ~ '^[0-9a-f]{64}$'), imported_at timestamptz not null,
  synthetic boolean not null default true check (synthetic)
);
create table public.raw_partner_rows (
  id uuid primary key, import_job_id uuid not null references public.partner_import_jobs(id) on delete restrict,
  row_number integer not null check (row_number>0), row_checksum text not null check (row_checksum ~ '^[0-9a-f]{32}$'),
  source_values jsonb not null check (jsonb_typeof(source_values)='object'), defect_tags text[] not null check (cardinality(defect_tags)>0),
  synthetic boolean not null default true check (synthetic), unique(import_job_id,row_number)
);
create index raw_partner_rows_defects_idx on public.raw_partner_rows using gin (defect_tags);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.app_users(id) on delete restrict,
  action text not null, occurred_at timestamptz not null default now(), correlation_id text not null, reason text not null,
  outcome text not null check (outcome in ('succeeded','failed')),
  safe_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_metadata)='object')
);
create index audit_events_actor_time_idx on public.audit_events (actor_id,occurred_at desc);

create or replace function private.reject_raw_partner_mutation() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.synthetic_reset',true),'')<>'on' then raise exception 'raw partner provenance is immutable'; end if;
  return old;
end; $$;
create trigger raw_partner_rows_immutable before update or delete on public.raw_partner_rows
for each row execute function private.reject_raw_partner_mutation();
create trigger partner_import_jobs_immutable before update or delete on public.partner_import_jobs
for each row execute function private.reject_raw_partner_mutation();

create or replace function private.seed_synthetic_baseline() returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare ref constant timestamptz := '2026-09-15 17:00:00+00';
begin
  insert into public.creators(id,business_id,fictional_name,handle,platforms,audience_archetype,voice,content_pillars,cta_style,attribution_parameters,compliance_notes,created_at) values
  (fixture_uuid('creator-1'),'CR-001','Ana Rivera (ficticia)','@CuentasConAna',array['Instagram Reels','TikTok'],'Familias jóvenes bilingües','Calmada, práctica y sin juicios',array['presupuesto','organización de facturas','preguntas útiles'],'Invitar a pedir información privada sin promesas','{"campaign":"ana_fictional","link_tag":"cr001"}','No implicar que organizarse cambia por sí solo los términos de una deuda.',ref),
  (fixture_uuid('creator-2'),'CR-002','Miguel Soto (ficticio)','@DineroSinVueltas',array['TikTok'],'Adultos hispanohablantes que buscan explicaciones sencillas','Directa, enérgica y simple',array['vocabulario de deuda','mitos','preparación'],'Conoce tus opciones, siempre en lenguaje condicional','{"campaign":"miguel_fictional","link_tag":"cr002"}','El tono directo no debe expresar certeza ni urgencia.',ref),
  (fixture_uuid('creator-3'),'CR-003','Sofía Torres (ficticia)','@HogarConRumbo',array['Instagram'],'Padres con obligaciones médicas y de tarjetas','Empática y narrativa',array['conversaciones familiares','documentos','preguntas comunes'],'Pedir información en privado','{"campaign":"sofia_fictional","link_tag":"cr003"}','Las historias son composiciones ficticias, no testimonios.',ref),
  (fixture_uuid('creator-4'),'CR-004','Diego Mendoza (ficticio)','@FinanzasDeBarrio',array['YouTube Shorts'],'Adultos que prefieren educación paso a paso','Medida y explicativa',array['comparaciones','rol del consejero','expectativas'],'Aprender y hablar con un consejero','{"campaign":"diego_fictional","link_tag":"cr004"}','Evitar recomendaciones legales o financieras.',ref),
  (fixture_uuid('creator-5'),'CR-005','Valeria Cruz (ficticia)','@PasoAPasoConVale',array['Instagram Reels','TikTok'],'Mujeres que administran finanzas del hogar','Cálida, alentadora y concisa',array['reducir vergüenza','preparar preguntas','reconocer promesas riesgosas'],'Iniciar un chat informativo','{"campaign":"valeria_fictional","link_tag":"cr005"}','El apoyo emocional no implica alivio garantizado.',ref);
  insert into public.content_sources(id,business_id,source_type,source_date,channel,theme,provenance)
  select fixture_uuid('source-'||n),'SRC-'||lpad(n::text,3,'0'),(array['fictional_question','fictional_objection','invented_trend'])[((n-1)%3)+1],date '2026-09-15'-(n-1),(array['instagram','tiktok','youtube','direct'])[((n-1)%4)+1],(array['organizar pagos','preguntas para un consejero','lenguaje condicional','privacidad','opciones educativas'])[((n-1)%5)+1],'synthetic_fictional' from generate_series(1,10)n;
  insert into public.leads(id,business_id,creator_id,content_source_id,source_event_id,received_at,reference_instant,channel,source_detail,fictional_phone,initial_status,case_tags)
  select fixture_uuid('lead-'||n),'LEAD-'||lpad(n::text,3,'0'),case when n between 43 and 46 then null else fixture_uuid('creator-'||(((n-1)%5)+1)) end,fixture_uuid('source-'||(((n-1)%10)+1)),'synthetic-event-'||lpad(n::text,3,'0'),ref-case when n>=47 then interval '72 hours'+n*interval '1 minute' else n*interval '1 hour' end,ref,case when n between 43 and 46 then 'organic'::public.lead_channel else 'ctwa' end,case when n between 43 and 46 then 'synthetic organic fixture' else 'synthetic creator fixture' end,'+155501'||lpad((n-1)::text,2,'0'),case when n between 34 and 42 then 'ignored'::public.lead_status when n between 17 and 33 then 'needs_review' else 'received' end,
  case when n<=8 then array['safe_complete'] when n<=16 then array['incomplete'] when n<=20 then array['ambiguous'] when n<=25 then array['risky_claim'] when n<=30 then array['unsupported_debt'] when n<=33 then array['sensitive_pattern'] when n<=36 then array['opt_out'] when n<=39 then array['spam'] when n<=42 then array['replay'] when n<=46 then array['organic'] else array['stale_after_hours'] end from generate_series(1,48)n;
  insert into public.messages(id,lead_id,source_message_id,direction,body,sent_at)
  select fixture_uuid('message-'||n),fixture_uuid('lead-'||n),'synthetic-message-'||lpad(n::text,3,'0'),'inbound',case when n between 31 and 33 then 'Dato sensible simulado [REDACTED_SYNTHETIC]; no corresponde a una persona real.' when n between 34 and 36 then 'Solicitud ficticia: no deseo recibir más mensajes.' when n between 37 and 39 then 'Contenido sintético no accionable.' else 'Mensaje ficticio '||lpad(n::text,3,'0')||' para probar el flujo de Nueva Ruta.' end,ref-case when n>=47 then interval '72 hours'+n*interval '1 minute' else n*interval '1 hour' end from generate_series(1,48)n;
  insert into public.consent_evidence(id,lead_id,status,source,captured_at,conversation_window_open)
  select fixture_uuid('consent-'||n),fixture_uuid('lead-'||n),case when n between 34 and 36 then 'withdrawn'::public.consent_status else 'granted' end,'synthetic_chat_assertion',ref-case when n>=47 then interval '72 hours'+n*interval '1 minute' else n*interval '1 hour' end,not(n between 34 and 36 or n>=47) from generate_series(1,48)n;
  insert into public.partner_import_jobs(id,business_id,filename,file_checksum,imported_at) values(fixture_uuid('partner-import-1'),'IMPORT-001','synthetic_partner_enrollments.csv',repeat('a',64),ref);
  insert into public.raw_partner_rows(id,import_job_id,row_number,row_checksum,source_values,defect_tags)
  select fixture_uuid('partner-row-'||n),fixture_uuid('partner-import-1'),n,md5(case when n in(1,2) then 'exact-duplicate' else 'partner-row-'||n end),jsonb_build_object('partner_enrollment_id',case when n in(1,2) then 'ENR-001' when n in(3,4) then 'ENR-CONFLICT' else 'ENR-'||lpad(n::text,3,'0') end,'partner_case_id',case when n in(1,2) then 'CASE-001' when n%7=0 then '' else 'CASE-'||lpad(n::text,3,'0') end,'enrollment_date_raw',case when n in(1,2) then '2026-09-01' when n=19 then '02/30/2026' when n=20 then '2030-01-01' when n=21 then '' when n=18 then '03/04/2026' else '2026-09-'||lpad(((n-1)%14+1)::text,2,'0') end,'phone_raw',case when n in(1,2) then '+1 555-0100' when n between 5 and 7 then (array['+1 555-0104','(555) 0104','5550104'])[n-4] when n=8 then '555-0107' when n=9 then '+1 555-0199' when n=10 then '+1 555-0177' else '+1 555-01'||lpad(((n-1)%48)::text,2,'0') end,'creator_id_raw',case when n in(1,2) then 'CR-001' when n=11 then '' when n=12 then 'CR-005' when n=13 then 'CR-999' else 'CR-'||lpad((((n-1)%5)+1)::text,3,'0') end,'status_raw','synthetic_reported'),
  case when n in(1,2) then array['exact_duplicate'] when n in(3,4) then array['conflicting_id'] when n between 5 and 7 then array['phone_format'] when n=8 then array['missing_country_code'] when n=9 then array['phone_mismatch'] when n=10 then array['unmatched_phone'] when n=11 then array['missing_creator'] when n=12 then array['contradictory_creator'] when n=13 then array['unknown_creator'] when n between 14 and 18 then array['date_format'] when n between 19 and 21 then array['date_quality'] when n between 22 and 25 then array['repeated_enrollment'] else array['ambiguous_link'] end from generate_series(1,30)n;
end; $$;

create or replace function public.reset_synthetic_baseline(p_actor_id uuid,p_confirmation text,p_reason text,p_correlation_id text) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare counts jsonb;
begin
  if p_confirmation<>'RESET SYNTHETIC BASELINE' then raise exception 'invalid reset confirmation' using errcode='22023'; end if;
  if not exists(select 1 from public.app_users where id=p_actor_id and role='supervisor' and active) then raise exception 'supervisor role required' using errcode='42501'; end if;
  if nullif(trim(p_reason),'') is null or nullif(trim(p_correlation_id),'') is null then raise exception 'reset reason and correlation_id are required' using errcode='22023'; end if;
  perform set_config('app.synthetic_reset','on',true);
  delete from public.raw_partner_rows; delete from public.partner_import_jobs; delete from public.consent_evidence;
  delete from public.messages; delete from public.leads; delete from public.content_sources; delete from public.creators;
  perform private.seed_synthetic_baseline();
  counts:=jsonb_build_object('creators',(select count(*) from public.creators),'content_sources',(select count(*) from public.content_sources),'leads',(select count(*) from public.leads),'messages',(select count(*) from public.messages),'partner_rows',(select count(*) from public.raw_partner_rows));
  insert into public.audit_events(actor_id,action,correlation_id,reason,outcome,safe_metadata) values(p_actor_id,'synthetic_baseline.reset',p_correlation_id,p_reason,'succeeded',counts);
  return counts;
end; $$;

revoke all on all tables in schema public from anon,authenticated;
grant select,insert,update,delete on all tables in schema public to service_role;
revoke all on function public.reset_synthetic_baseline(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reset_synthetic_baseline(uuid,text,text,text) to service_role;
revoke all on function private.seed_synthetic_baseline() from public;
revoke all on function private.fixture_uuid(text) from public;
alter table public.app_users enable row level security; alter table public.creators enable row level security;
alter table public.content_sources enable row level security; alter table public.leads enable row level security;
alter table public.messages enable row level security; alter table public.consent_evidence enable row level security;
alter table public.partner_import_jobs enable row level security; alter table public.raw_partner_rows enable row level security;
alter table public.audit_events enable row level security;
