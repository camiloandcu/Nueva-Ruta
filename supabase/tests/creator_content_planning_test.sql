begin;
select plan(30);

select lives_ok($$
  select public.reset_synthetic_baseline(
    (select id from public.app_users where role='supervisor' and active limit 1),
    'RESET SYNTHETIC BASELINE','WI-008 creator content test','wi008-reset-one'
  )
$$,'reset restores creator content fixtures');
select set_config('app.synthetic_reset','off',true);
select is((select count(*)::integer from public.creators),5,'all five creator identities remain stable');
select is((select count(*)::integer from public.content_sources),10,'all ten source identities remain stable');
select is((select count(*)::integer from public.content_sources where length(display_text)>20 and risk_reason<>''),10,
  'every source has synthetic display text and explicit risk evidence');
select is((select count(*)::integer from public.content_sources where compliance_risk='high'),1,
  'one high-risk fictional source is visible for ranking but not script selection');
select is((select count(*)::integer from public.creator_content_scripts),3,'three stable script identities are seeded');
select is((select count(*)::integer from public.creator_content_script_versions),3,'three initial script versions are seeded');
select is((select count(*)::integer from public.creator_content_script_reviews),0,'initial scripts remain pending review');
select is((select count(*)::integer from public.creator_content_script_versions
  where estimated_duration_seconds not between 30 and 45),0,
  'all initial Spanish scripts are estimated at 30 to 45 seconds');
select is((select count(*)::integer from public.creator_content_script_versions
  where body_checksum<>encode(extensions.digest(body,'sha256'),'hex')),0,
  'all initial script checksums match their immutable body');
select is((select count(*)::integer from public.creator_content_script_versions version
  join public.content_sources source on source.id=version.source_id where source.compliance_risk='high'),0,
  'high-risk source is not linked to a script');

select lives_ok($$select public.creator_content_facts((select id from public.app_users where role='analyst' and active limit 1))$$,
  'analyst can read minimized creator content facts');
select ok(not (public.creator_content_facts((select id from public.app_users where role='analyst' and active limit 1))::text
  ~ 'fictional_phone|redacted_body|source_values'),'creator content facts exclude phone and message/source detail');
select throws_ok($$select public.creator_content_facts('00000000-0000-0000-0000-000000000000')$$,
  '42501','active creator-content role required','unmapped actor cannot read creator content facts');
select ok(has_function_privilege('service_role','public.creator_content_facts(uuid)','EXECUTE'),
  'service role can invoke creator content facts');
select ok(not has_function_privilege('authenticated','public.creator_content_facts(uuid)','EXECUTE'),
  'authenticated role cannot bypass the API boundary');
select throws_ok($$update public.creator_content_script_versions set body='changed'$$,
  '55000','creator content versions and review evidence are immutable','script version content cannot be rewritten');

select throws_ok($$select public.create_creator_script_version(
  (select id from public.app_users where role='analyst' and active limit 1),
  (select id from public.creator_content_scripts where business_id='SCRIPT-001'),
  (select id from public.creators where business_id='CR-001'),
  (select id from public.content_sources where business_id='SRC-001'),
  'Synthetic rationale for analyst rejection.',repeat('a',100),repeat('a',64),80,35
)$$,'42501','active author role required','analyst cannot create script versions');
select throws_ok($$select public.create_creator_script_version(
  (select id from public.app_users where role='operator' and active limit 1),
  (select id from public.creator_content_scripts where business_id='SCRIPT-001'),
  (select id from public.creators where business_id='CR-001'),
  (select id from public.content_sources where business_id='SRC-008'),
  'Synthetic rationale for high risk rejection.',repeat('a',100),repeat('a',64),80,35
)$$,'23514','source unavailable for script approval','high-risk source cannot be used for a new script version');

select lives_ok($$select public.create_creator_script_version(
  (select id from public.app_users where role='operator' and active limit 1),
  (select id from public.creator_content_scripts where business_id='SCRIPT-001'),
  (select id from public.creators where business_id='CR-001'),
  (select id from public.content_sources where business_id='SRC-001'),
  'Synthetic rationale for creating a reviewable version.',repeat('a',100),repeat('b',64),80,35
)$$,'operator can submit a version for human review');
select is((select count(*)::integer from public.creator_content_script_versions where version=2),1,
  'new script copy is stored as a new immutable version');
select lives_ok($$select public.create_creator_script_version(
  (select id from public.app_users where role='operator' and active limit 1),
  (select id from public.creator_content_scripts where business_id='SCRIPT-001'),
  (select id from public.creators where business_id='CR-004'),
  (select id from public.content_sources where business_id='SRC-002'),
  'A newer rationale for replacing a prior script version.',repeat('c',100),repeat('c',64),80,35
)$$,'operator can create the next immutable version');
select throws_ok($$select public.review_creator_script_version(
  (select id from public.app_users where role='operator' and active limit 1),
  (select id from public.creator_content_script_versions where version=3),'approved','Test review reason'
)$$,'42501','supervisor review role required','operator cannot record final review');
select throws_ok($$select public.review_creator_script_version(
  (select id from public.app_users where role='supervisor' and active limit 1),
  (select id from public.creator_content_script_versions where version=2),'approved','Stale review reason'
)$$,'23514','only the latest script version can be reviewed','supervisor cannot approve a stale version');
select lives_ok($$select public.review_creator_script_version(
  (select id from public.app_users where role='supervisor' and active limit 1),
  (select id from public.creator_content_script_versions where version=3),'approved','Approved synthetic test version'
)$$,'supervisor can record a script review decision');
select is((select decision from public.creator_content_script_reviews review
  join public.creator_content_script_versions version on version.id=review.script_version_id
  where version.version=3),'approved','review decision is append-only evidence');

select lives_ok($$
  select public.reset_synthetic_baseline(
    (select id from public.app_users where role='supervisor' and active limit 1),
    'RESET SYNTHETIC BASELINE','WI-008 repeatability test','wi008-reset-two'
  )
$$,'a second reset restores deterministic content planning state');
select is((select count(*)::integer from public.creator_content_script_versions),3,
  'second reset restores exactly three initial versions');
select is((select count(*)::integer from public.creator_content_script_reviews),0,
  'reset clears synthetic review fixtures and retains reset audit history');
select is((select count(*)::integer from public.creator_content_script_versions version
  join public.creator_content_scripts script on script.id=version.script_id where script.business_id like 'SCRIPT-%'),3,
  'stable script identifiers remain linked after reset');

select * from finish();
rollback;
