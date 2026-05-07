import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyCodexTurnProfile, applyCodexTurnProfileText, validateConfig } from "../src/index.js";

test("applyCodexTurnProfileText preserves unrelated config", () => {
  const existing = 'model = "gpt-5.5"\n\n[model_providers.openai]\nname = "OpenAI"\n';
  const after = applyCodexTurnProfileText(existing, {
    baseUrl: "http://127.0.0.1:9090/v1",
    model: "gpt-5.5"
  });

  assert.match(after, /\[model_providers\.openai\]/);
  assert.match(after, /\[model_providers\.codex-turn\]/);
  assert.match(after, /\[profiles\.codex-turn\]/);
  validateConfig(after);
});

test("applyCodexTurnProfileText updates existing managed blocks", () => {
  const existing = `[model_providers.codex-turn]\nname = "Old"\nbase_url = "old"\n\n[profiles.codex-turn]\nmodel = "old"\n`;
  const after = applyCodexTurnProfileText(existing, {
    baseUrl: "http://127.0.0.1:8787/v1",
    model: "gpt-new"
  });

  assert.doesNotMatch(after, /Old/);
  assert.doesNotMatch(after, /gpt-old/);
  assert.match(after, /base_url = "http:\/\/127\.0\.0\.1:8787\/v1"/);
  assert.match(after, /model = "gpt-new"/);
});

test("applyCodexTurnProfile writes backup", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-turn-"));
  const configPath = path.join(dir, "config.toml");
  await fs.writeFile(configPath, 'model = "old"\n', "utf8");

  const result = await applyCodexTurnProfile(
    { baseUrl: "http://127.0.0.1:9090/v1", model: "gpt-5.5" },
    { configPath }
  );

  assert.equal(result.changed, true);
  assert.ok(result.backupPath);
  assert.equal(await fs.readFile(result.backupPath!, "utf8"), 'model = "old"\n');
  assert.match(await fs.readFile(configPath, "utf8"), /\[profiles\.codex-turn\]/);
});

test("invalid TOML is rejected", () => {
  assert.throws(() => applyCodexTurnProfileText("[broken", {
    baseUrl: "http://127.0.0.1:9090/v1",
    model: "gpt-5.5"
  }));
});
