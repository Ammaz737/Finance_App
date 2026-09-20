import { spawn } from "node:child_process";
import { resolve } from "node:path";

const target = process.argv[2];
const root = resolve(import.meta.dirname, "..");
const apps = {
  api: {
    cwd: resolve(root, "apps/api"),
    executable: resolve(root, "apps/api/node_modules/tsx/dist/cli.mjs"),
    args: ["watch", "--env-file=.env", "src/app/server.ts"],
  },
  web: {
    cwd: resolve(root, "apps/web"),
    executable: resolve(root, "apps/web/node_modules/next/dist/bin/next"),
    args: ["dev", "-p", "3002"],
  },
  worker: {
    cwd: resolve(root, "apps/worker"),
    executable: resolve(root, "apps/worker/node_modules/tsx/dist/cli.mjs"),
    args: ["watch", "--env-file=.env", "src/index.ts"],
  },
};

const config = apps[target];
if (!config) {
  console.error(`Unknown dev target: ${target ?? "(missing)"}`);
  process.exit(1);
}

const child = spawn(process.execPath, [config.executable, ...config.args], {
  cwd: config.cwd,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
