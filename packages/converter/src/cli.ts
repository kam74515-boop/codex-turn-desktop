#!/usr/bin/env node
import { configFromEnv } from "./config.js";
import { createServer } from "./server.js";

const cfg = configFromEnv();
const server = createServer(cfg);

server.listen(cfg.port, cfg.host, () => {
  console.log(`Codex Turn converter listening on http://${cfg.host}:${cfg.port}/v1`);
  console.log(`Responses upstream: ${cfg.responsesBaseUrl}`);
  console.log(`Completions upstream: ${cfg.completionsBaseUrl}`);
  console.log(`Chat upstream: ${cfg.chatUpstream}`);
});
