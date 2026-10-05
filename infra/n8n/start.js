const { spawn, spawnSync } = require("node:child_process");

function runN8n(args) {
  const result = spawnSync("n8n", args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runN8n(["import:workflow", "--input=/opt/n8n/workflows", "--separate"]);
runN8n(["update:workflow", "--all", "--active=true"]);

const processRunner = spawn("n8n", ["start"], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => processRunner.kill(signal));
}
processRunner.on("exit", (code, signal) => {
  process.exit(code ?? (signal === "SIGTERM" ? 0 : 1));
});
