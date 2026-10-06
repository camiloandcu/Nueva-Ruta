import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

import { defineConfig } from "@playwright/test";

const localEnv = resolve(__dirname, "../../.env");
if (existsSync(localEnv)) loadEnvFile(localEnv);

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
