import { existsSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.join(root, ".next");
const forceClean = process.argv.includes("--clean");

const required = [
  "build-manifest.json",
  "server/webpack-runtime.js",
  "server/app-paths-manifest.json",
];

function cacheBroken() {
  if (!existsSync(nextDir)) return false;
  return required.some((rel) => !existsSync(path.join(nextDir, rel)));
}

if (forceClean || cacheBroken()) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log(
    forceClean
      ? "Cleared .next (forced)."
      : "Cleared a broken .next cache so the app can boot."
  );
}

const extra = process.argv.slice(2).filter((arg) => arg !== "--clean");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", ...extra], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
