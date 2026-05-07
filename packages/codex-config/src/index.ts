import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import TOML from "@iarna/toml";

export interface CodexTurnProfileInput {
  baseUrl: string;
  model: string;
  providerId?: string;
  profileId?: string;
}

export interface ApplyResult {
  configPath: string;
  backupPath?: string;
  before: string;
  after: string;
  changed: boolean;
}

const DEFAULT_PROVIDER_ID = "codex-turn";
const DEFAULT_PROFILE_ID = "codex-turn";

export function codexConfigPath(home = os.homedir()): string {
  return path.join(home, ".codex", "config.toml");
}

export async function readConfig(configPath = codexConfigPath()): Promise<string> {
  try {
    return await fs.readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export function validateConfig(text: string): void {
  if (!text.trim()) return;
  TOML.parse(text);
}

export async function backupConfig(configPath = codexConfigPath()): Promise<string | undefined> {
  const before = await readConfig(configPath);
  if (!before) return undefined;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${configPath}.codex-turn-backup-${stamp}`;
  await fs.copyFile(configPath, backupPath);
  return backupPath;
}

export function applyCodexTurnProfileText(existing: string, input: CodexTurnProfileInput): string {
  validateConfig(existing);
  const providerId = input.providerId ?? DEFAULT_PROVIDER_ID;
  const profileId = input.profileId ?? DEFAULT_PROFILE_ID;
  const cleaned = stripManagedBlocks(existing, providerId, profileId).trimEnd();
  const block = [
    "",
    `[model_providers.${providerId}]`,
    `name = "Codex Turn"`,
    `base_url = "${escapeTomlString(input.baseUrl)}"`,
    `wire_api = "responses"`,
    "",
    `[profiles.${profileId}]`,
    `model_provider = "${escapeTomlString(providerId)}"`,
    `model = "${escapeTomlString(input.model)}"`,
    ""
  ].join("\n");

  const after = `${cleaned}${block}`;
  validateConfig(after);
  return after;
}

export async function applyCodexTurnProfile(
  input: CodexTurnProfileInput,
  options: { configPath?: string; dryRun?: boolean } = {}
): Promise<ApplyResult> {
  const configPath = options.configPath ?? codexConfigPath();
  const before = await readConfig(configPath);
  const after = applyCodexTurnProfileText(before, input);
  const changed = before !== after;
  let backupPath: string | undefined;

  if (!options.dryRun && changed) {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    backupPath = await backupConfig(configPath);
    await fs.writeFile(configPath, after, "utf8");
  }

  return { configPath, backupPath, before, after, changed };
}

function stripManagedBlocks(text: string, providerId: string, profileId: string): string {
  const providerPattern = new RegExp(`\\n?\\[model_providers\\.${escapeRegExp(providerId)}\\]\\n[\\s\\S]*?(?=\\n\\[|$)`, "g");
  const profilePattern = new RegExp(`\\n?\\[profiles\\.${escapeRegExp(profileId)}\\]\\n[\\s\\S]*?(?=\\n\\[|$)`, "g");
  return text.replace(providerPattern, "").replace(profilePattern, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
