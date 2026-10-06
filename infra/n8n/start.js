const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");

process.env.PATH = ["/usr/local/bin", process.env.PATH ?? ""]
  .filter(Boolean)
  .join(":");

function runN8n(args) {
  const result = spawnSync("/usr/local/bin/n8n", args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runN8n(["import:workflow", "--input=/opt/n8n/workflows", "--separate"]);
const workflows = fs
  .readdirSync("/opt/n8n/workflows")
  .filter((file) => file.endsWith(".json"))
  .map((file) =>
    JSON.parse(fs.readFileSync(`/opt/n8n/workflows/${file}`, "utf8")),
  );
for (const workflow of workflows) {
  if (workflow.id) {
    runN8n(["publish:workflow", `--id=${workflow.id}`]);
  }
}

const processRunner = spawn("/usr/local/bin/n8n", ["start"], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => processRunner.kill(signal));
}
processRunner.on("exit", (code, signal) => {
  process.exit(code ?? (signal === "SIGTERM" ? 0 : 1));
});
