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
