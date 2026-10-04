begin;
select plan(22);

select is((select count(*) from public.rule_versions), 2::bigint, 'historical v1 and current v2 are seeded');
select is((select count(*) from public.rule_versions where active), 1::bigint, 'seeded version is active');
select is((select version from public.rule_versions where active), 2, 'approved reporting policy is active as version two');
select is((select content_hash from public.rule_versions where active), '5a3356441b5ae2e3a3b43a718bfa5776605af2f5ef5aa6246b5ff887cbf61316', 'v2 seed hash is stable');
select is((select (content #>> '{debt_policy,minimum}')::integer from public.rule_versions where active), 5000, 'minimum debt is approved');
select is((select (content #>> '{debt_policy,maximum}')::integer from public.rule_versions where active), 100000, 'maximum debt is approved');
select is((select content #>> '{operating_schedule,timezone}' from public.rule_versions where active), 'America/New_York', 'timezone is approved');
select is((select jsonb_array_length(content->'automatic_templates') from public.rule_versions where active), 3, 'exactly three automatic templates');

select throws_ok(
  $$update public.rule_versions set content = '{}'::jsonb where active$$,
  '55000', 'published rule versions are immutable', 'published content cannot change'
);
select throws_ok(
  $$delete from public.rule_versions where active$$,
  '55000', 'published rule versions are immutable', 'published history cannot be deleted'
);

insert into public.rule_drafts(content, content_hash, valid, source_name, created_by)
select content, repeat('a', 64), true, 'test rollback', private.fixture_uuid('rule-system-actor')
from public.rule_versions where version = 2;
select is((select count(*) from public.rule_drafts), 1::bigint, 'draft persists separately');
select ok((select derived_from_version_id is null from public.rule_drafts limit 1), 'ordinary draft has no rollback lineage');
select ok((select active from public.rule_versions where version = 2), 'draft creation does not change active version');

insert into public.rule_drafts(content, content_hash, valid, source_name, created_by)
select jsonb_set(content, '{escalation,sla_minutes}', '45'::jsonb), repeat('b', 64), true,
  'publish test', (select id from public.app_users where role = 'supervisor' limit 1)
from public.rule_versions where version = 2;
select public.publish_rule_draft(
  (select id from public.rule_drafts where source_name = 'publish test'),
  (select id from public.app_users where role = 'supervisor' limit 1),
  repeat('b', 64), 'reviewed test change', 'rule-publish-1'
);
select is((select max(version) from public.rule_versions), 3, 'publication allocates next version');
select is((select parent_version_id from public.rule_versions where version = 3),
  (select id from public.rule_versions where version = 2), 'publication records active parent');
select is((select count(*) from public.audit_events where action = 'rules.publish'), 1::bigint,
  'publication creates audit evidence');

insert into public.rule_drafts(
  content, content_hash, valid, source_name, created_by, derived_from_version_id
)
select content, content_hash, true, 'rollback test',
  (select id from public.app_users where role = 'supervisor' limit 1), id
from public.rule_versions where version = 2;
select public.publish_rule_draft(
  (select id from public.rule_drafts where source_name = 'rollback test'),
  (select id from public.app_users where role = 'supervisor' limit 1),
  '5a3356441b5ae2e3a3b43a718bfa5776605af2f5ef5aa6246b5ff887cbf61316',
  'reviewed rollback', 'rule-publish-2'
);
select is((select max(version) from public.rule_versions), 4, 'rollback is a new monotonic version');
select is((select derived_from_version_id from public.rule_versions where version = 4),
  (select id from public.rule_versions where version = 2), 'rollback preserves derivation lineage');
select is((select parent_version_id from public.rule_versions where version = 4),
  (select id from public.rule_versions where version = 3), 'rollback preserves current parent');
select ok((select active from public.rule_versions where version = 4), 'rollback version becomes active');

insert into public.rule_drafts(content, content_hash, valid, source_name, created_by)
select content, repeat('c', 64), true, 'stale test',
  (select id from public.app_users where role = 'supervisor' limit 1)
from public.rule_versions where version = 4;
select throws_ok(
  format(
    'select public.publish_rule_draft(%L, %L, %L, %L, %L)',
    (select id from public.rule_drafts where source_name = 'stale test'),
    (select id from public.app_users where role = 'supervisor' limit 1),
    repeat('d', 64), 'stale confirmation', 'rule-publish-stale'
  ), '40001', 'stale content hash confirmation', 'stale hash is rejected'
);

insert into public.rule_drafts(content, content_hash, valid, source_name, created_by)
select content, content_hash, true, 'duplicate test',
  (select id from public.app_users where role = 'supervisor' limit 1)
from public.rule_versions where version = 4;
select throws_ok(
  format(
    'select public.publish_rule_draft(%L, %L, %L, %L, %L)',
    (select id from public.rule_drafts where source_name = 'duplicate test'),
    (select id from public.app_users where role = 'supervisor' limit 1),
    '5a3356441b5ae2e3a3b43a718bfa5776605af2f5ef5aa6246b5ff887cbf61316',
    'duplicate confirmation', 'rule-publish-duplicate'
  ), '23505', 'duplicate active rule content', 'duplicate publication is rejected'
);

select * from finish();
rollback;
