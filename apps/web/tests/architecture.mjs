import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the web API client targets FastAPI health", () => {
  const client = readFileSync(
    new URL("../lib/api-client/health.ts", import.meta.url),
    "utf8",
  );
  assert.match(client, /API_BASE_URL|apiBaseUrl/);
  assert.match(client, /health\/ready/);
});

test("the Supabase server client is isolated to authentication", () => {
  const client = readFileSync(
    new URL("../lib/auth/server.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(client, /\.from\(|\.rpc\(/);
});

test("the demo login uses Supabase password auth without public signup", () => {
  const login = readFileSync(
    new URL("../app/login/page.tsx", import.meta.url),
    "utf8",
  );
  const actions = readFileSync(
    new URL("../app/login/actions.ts", import.meta.url),
    "utf8",
  );
  const layout = readFileSync(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.match(login, /action=\{signIn\}/);
  assert.match(actions, /signInWithPassword/);
  assert.doesNotMatch(actions, /\.signUp\(/);
  assert.match(actions, /supabase\.auth\.signOut\(\)/);
  assert.match(layout, /Cerrar sesión/);
});

test("rule operations flow through authenticated FastAPI proxy", () => {
  const proxy = readFileSync(
    new URL("../app/api/rules/[...path]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(proxy, /supabase\.auth\.getSession/);
  assert.match(proxy, /\/v1\/rules\//);
  assert.doesNotMatch(proxy, /\.from\(|\.rpc\(/);
});

test("rule review requires diff and exact hash before publication", () => {
  const review = readFileSync(
    new URL("../app/rules/rule-review.tsx", import.meta.url),
    "utf8",
  );
  assert.match(review, /\/diff/);
  assert.match(review, /content_hash: draft\.content_hash/);
  assert.match(review, /disabled=\{!draft\.valid \|\| !changes\.length\}/);
  assert.match(review, /\/rollback-drafts/);
  assert.match(review, /solo un supervisor/);
});

test("WI-004 operations use authenticated FastAPI proxy only", () => {
  const proxy = readFileSync(
    new URL("../app/api/operations/[...path]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(proxy, /supabase\.auth\.getSession/);
  assert.match(proxy, /apiBaseUrl/);
  assert.doesNotMatch(proxy, /\.from\(|\.rpc\(/);
});

test("human review exposes redacted leads and keeps approval undelivered", () => {
  const review = readFileSync(
    new URL("../app/operations/review/review-queue.tsx", import.meta.url),
    "utf8",
  );
  assert.match(review, /redacted-leads/);
  assert.match(review, /Aprobar sin entregar/);
  assert.doesNotMatch(review, /original_body|restricted_event_evidence/);
});

test("AI operations exposes exact safe execution dimensions", () => {
  const timeline = readFileSync(
    new URL("../app/operations/ai/timeline.tsx", import.meta.url),
    "utf8",
  );
  assert.match(timeline, /correlation_id/);
  assert.match(timeline, /failure_layer/);
  assert.match(timeline, /normalized_reason/);
  assert.doesNotMatch(
    timeline,
    /original_body|redacted_body|prompt_version|reasoning/,
  );
});

test("WI-005 CRM UI exposes documented dispositions, recovery, and guarded actions", () => {
  const crm = readFileSync(
    new URL("../app/operations/crm/crm-operations.tsx", import.meta.url),
    "utf8",
  );
  const dispositionOptions = crm.match(
    /const dispositionOptions = \[([\s\S]*?)\];/,
  );
  assert.ok(dispositionOptions);
  assert.deepEqual(
    [...dispositionOptions[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    ["No Answer", "Info Sent", "Transferido", "Call Back", "No le interesa"],
  );
  assert.match(crm, /callback_at/);
  assert.match(crm, /Teléfono: \{lead\.fictional_phone \?\? "No disponible"\}/);
  assert.match(crm, /Historial de disposiciones/);
  assert.match(crm, /prior_stage.*resulting_stage/s);
  assert.match(crm, /disabled=\{\s*lead\.opted_out \|\|\s*!\s*\[/);
  assert.match(crm, /"prequalified"[\s\S]*"callback_scheduled"/);
  assert.match(crm, /delivery\.status === "dead_letter"/);
  assert.match(crm, /Reintentar manualmente/);
  assert.match(crm, /aria-live="polite"/);
});

test("WI-006 import UI preserves synthetic-only boundary and dispatches through n8n", () => {
  const screen = readFileSync(
    new URL(
      "../app/operations/partners/partner-reconciliation.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(screen, /synthetic_confirmation/);
  assert.ok(screen.includes("partner-imports/${jobId}/dispatch"));
  assert.match(screen, /Valores normalizados:/);
  assert.match(screen, /Evidencia de transformación/);
  assert.match(screen, /quality_issues/);
  assert.match(screen, /Aceptar candidato/);
  assert.match(screen, /Enlazar manualmente/);
  assert.match(screen, /Potencialmente comisionables/);
  assert.match(screen, /Revisión previa/);
  assert.match(screen, /aria-live="polite"/);
  const dispatch = readFileSync(
    new URL(
      "../app/api/partner-imports/[id]/dispatch/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(dispatch, /supabase\.auth\.getSession/);
  assert.match(dispatch, /N8N_PARTNER_IMPORT_WEBHOOK_URL/);
  assert.match(dispatch, /Authorization: `Bearer \$\{token\}`/);
});

test("WI-007 reports use the authenticated FastAPI proxy and preserve attribution caveats", () => {
  const dashboard = readFileSync(
    new URL("../app/operations/reports/reports-dashboard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(dashboard, /\/api\/operations\/reports\/overview/);
  assert.match(dashboard, /\/api\/operations\/reports\/enrollments/);
  assert.match(dashboard, /Denominador/);
  assert.match(dashboard, /Sin atribución/);
  assert.match(dashboard, /no calcula dinero/i);
  assert.match(dashboard, /stalled_pagination/);
  assert.match(dashboard, /Siguiente/);
  assert.doesNotMatch(dashboard, /supabase\.from\(|supabase\.rpc\(/);
  const page = readFileSync(
    new URL("../app/operations/reports/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Datos y reporting/);
  const home = readFileSync(
    new URL("../app/home-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(home, /\/operations\/reports/);
});

test("WI-008 creator planning uses safe authenticated API contracts and role-gated actions", () => {
  const planning = readFileSync(
    new URL("../app/operations/creators/planning.tsx", import.meta.url),
    "utf8",
  );
  assert.match(planning, /\/api\/operations\/creators/);
  assert.match(planning, /content\/sources\/ranking/);
  assert.match(planning, /content\/scripts/);
  assert.match(planning, /creator-content\/access/);
  assert.match(planning, /access\.can_author/);
  assert.match(planning, /access\.can_review/);
  assert.match(planning, /Prioridad descriptiva/);
  assert.match(planning, /No hay acciones de publicación\s+o programación/);
  assert.match(planning, /script_selectable/);
  assert.match(planning, /latest\.review\?\.reason/);
  assert.doesNotMatch(
    planning,
    /supabase\.from\(|supabase\.rpc\(|publish|schedule/i,
  );
  const page = readFileSync(
    new URL("../app/operations/creators/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Sistema de contenido/);
  assert.match(page, /guiones pendientes de revisión/);
  const home = readFileSync(
    new URL("../app/home-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(home, /\/operations\/creators/);
});
