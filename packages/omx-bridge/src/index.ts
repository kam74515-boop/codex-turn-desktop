import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface OmxRunOptions {
  repoRoot?: string;
  args: string[];
  timeoutMs?: number;
}

export interface OmxRunResult {
  command: string;
  code: number | null;
  stdout: string;
  stderr: string;
}

export function vendorRoot(repoRoot = process.cwd()): string {
  return path.join(findRepoRoot(repoRoot), "vendor", "oh-my-codex");
}

export function vendoredCommit(repoRoot = process.cwd()): string | undefined {
  const file = path.join(vendorRoot(repoRoot), "VENDORED_COMMIT");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : undefined;
}

export function omxCliPath(repoRoot = process.cwd()): string {
  return path.join(vendorRoot(repoRoot), "dist", "cli", "omx.js");
}

export function omxReady(repoRoot = process.cwd()): boolean {
  return fs.existsSync(omxCliPath(repoRoot));
}

export function runOmx(options: OmxRunOptions): Promise<OmxRunResult> {
  const root = options.repoRoot ?? process.cwd();
  const cli = omxCliPath(root);
  const command = `node ${cli} ${options.args.join(" ")}`;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...options.args], {
      cwd: vendorRoot(root),
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGTERM");
        }, options.timeoutMs)
      : undefined;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ command, code, stdout, stderr });
    });
  });
}

export function buildOmxCommands(repoRoot = process.cwd()): Record<string, string[]> {
  const root = vendorRoot(repoRoot);
  return {
    install: ["npm", "install", "--prefix", root],
    build: ["npm", "run", "build", "--prefix", root],
    doctor: [process.execPath, omxCliPath(repoRoot), "doctor"],
    setup: [process.execPath, omxCliPath(repoRoot), "setup"],
    update: [process.execPath, omxCliPath(repoRoot), "update"],
    madmaxHigh: [process.execPath, omxCliPath(repoRoot), "--madmax", "--high"],
    directYolo: [process.execPath, omxCliPath(repoRoot), "--direct", "--yolo"]
  };
}

function findRepoRoot(start: string): string {
  let current = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(current, "vendor", "oh-my-codex"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}
