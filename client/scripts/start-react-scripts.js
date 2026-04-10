const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const cachePaths = [
  path.join(projectRoot, "node_modules", ".cache", "babel-loader"),
  path.join(projectRoot, "node_modules", ".cache", "default-development"),
  path.join(projectRoot, "node_modules", ".cache", ".eslintcache"),
];

for (const cachePath of cachePaths) {
  fs.rmSync(cachePath, { recursive: true, force: true });
}

const reactScriptsBin = require.resolve("react-scripts/bin/react-scripts");
const child = spawn(process.execPath, [reactScriptsBin, "start"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
