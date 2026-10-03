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
  const proxy = readFileSync(new URL("../app/api/operations/[...path]/route.ts", import.meta.url), "utf8");
  assert.match(proxy, /supabase\.auth\.getSession/);
  assert.match(proxy, /apiBaseUrl/);
  assert.doesNotMatch(proxy, /\.from\(|\.rpc\(/);
});

test("human review exposes redacted leads and keeps approval undelivered", () => {
  const review = readFileSync(new URL("../app/operations/review/review-queue.tsx", import.meta.url), "utf8");
  assert.match(review, /redacted-leads/);
  assert.match(review, /Aprobar sin entregar/);
  assert.doesNotMatch(review, /original_body|restricted_event_evidence/);
});

test("AI operations exposes exact safe execution dimensions", () => {
  const timeline = readFileSync(new URL("../app/operations/ai/timeline.tsx", import.meta.url), "utf8");
  assert.match(timeline, /correlation_id/);
  assert.match(timeline, /failure_layer/);
  assert.match(timeline, /normalized_reason/);
  assert.doesNotMatch(timeline, /message|prompt|reasoning/);
});
