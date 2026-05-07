#!/usr/bin/env node
import { runOmx } from "./index.js";

const args = process.argv.slice(2);
const result = await runOmx({ args });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.code ?? 1);
