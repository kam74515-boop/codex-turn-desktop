import assert from "node:assert/strict";
import test from "node:test";
import { buildOmxCommands, vendoredCommit, vendorRoot } from "../src/index.js";

test("vendor root and pinned commit are discoverable", () => {
  assert.match(vendorRoot(process.cwd()), /vendor\/oh-my-codex$/);
  assert.match(vendoredCommit(process.cwd()) ?? "", /^[a-f0-9]{40}$/);
});

test("common omx commands are exposed", () => {
  const commands = buildOmxCommands(process.cwd());
  assert.deepEqual(commands.doctor?.slice(-1), ["doctor"]);
  assert.deepEqual(commands.madmaxHigh?.slice(-2), ["--madmax", "--high"]);
  assert.deepEqual(commands.directYolo?.slice(-2), ["--direct", "--yolo"]);
});
