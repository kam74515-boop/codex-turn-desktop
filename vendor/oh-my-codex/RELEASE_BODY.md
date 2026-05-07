# oh-my-codex v0.16.0

## Summary

`0.16.0` is a minor release for skill deprecation and native Codex goal-mode integration. It moves long-running workflow coordination toward durable repo artifacts plus explicit Codex goal reconciliation, while cleaning up obsolete plugin-delivered skill surfaces.

Release candidate readiness pending final verification.

## Highlights

- **Goal-mode native workflows** — `ultragoal`, `performance-goal`, and `autoresearch-goal` add durable plans, evaluator/professor-critic gates, ledgers, and model-facing Codex goal handoffs.
- **Snapshot-reconciled completion** — completion checkpoints require fresh `get_goal` evidence that the expected objective is complete, preventing shell-only false completion.
- **Skill delivery cleanup** — obsolete skills retired from installable/plugin delivery where catalog-deprecated; deprecated root wrappers may remain as compatibility stubs.
- **Autoresearch migration** — direct `omx autoresearch` remains deprecated; use `$autoresearch` and `omx autoresearch-goal` for goal-mode-backed research workflows.
- **Runtime reliability** — Team/Ralph handoffs, question batch handshakes, Stop hooks, boxed state routing, notification proxy handling, and explore startup bounds were hardened.
- **Pipeline and docs polish** — GitHub package pipeline templates, Discord/proxy setup docs, and goal workflow docs are included.

## Merged PRs / notable commits

- #2132 — Retire obsolete OMX skills
- #2117 — Protect goal workflows with snapshot reconciliation
- #2113 — Honor proxy environments for notification transports
- #2106 — Bound explore startup env and Codex timeouts
- #2104 — Add Lore commit guard opt-out
- #2102 — Add first-class ultragoal prompt workflow
- #2100 — Make madmax launches own isolated runtime state
- #2097 — Make multi-goal execution durable around Codex goal mode
- #2095 — Let Ralph verifier children finish
- #2092 — Clarify plugin setup guidance source
- #2088 — Add GitHub package pipeline templates
- #2086 — Fix boxed team state path routing
- #2082 — Fix Ralph session state rebinding
- #2078 — Fix MCP duplicate sibling cleanup leak
- #2076 — Clarify ralplan handoff continuation status
- #2074 — Clarify Discord webhook and bot setup
- #2065 — Replace team stall nudges with worker Stop hook
- #2055 — Integrate Ralph with Codex goal mode

## Upgrade notes

- `ultragoal`, `performance-goal`, and `autoresearch-goal` require fresh Codex goal snapshots for durable completion reconciliation; OMX does not mutate hidden Codex goal state directly.
- Treat direct `omx autoresearch` as deprecated. Use `$autoresearch` or `omx autoresearch-goal` instead.
- If you relied on plugin-delivered deprecated skills, migrate to the active replacement skill or workflow listed by `omx list` / generated skill docs.
- Publication remains blocked until local verification and GitHub CI are green.

## Verification

Release verification evidence is tracked in `docs/qa/release-readiness-0.16.0.md`. Final publication requires local gates plus GitHub CI.

## Contributors

Thanks to @Yeachan-Heo, @HaD0Yun, @pgagarinov, and dependabot for contributions in this range.

**Full Changelog**: [`v0.15.3...v0.16.0`](https://github.com/Yeachan-Heo/oh-my-codex/compare/v0.15.3...v0.16.0)
