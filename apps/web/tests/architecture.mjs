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
