# Early Heat Radar — WebChat Remote Command Contract

This file defines the persistent remote-development shorthand for Early Heat Radar.

## Shorthand

### "Early Heat 상태" / "Early Heat 원격 상태 확인"
Create one job in `KHS_REMOTE/earlyheat_jobs/*.json`:

```json
{
  "request_id": "<unique id>",
  "project": "EARLY_HEAT_RADAR",
  "action": "status"
}
```

This is read-only and may use an approved shared Windows self-hosted runner.

### "Early Heat 계속"
Interpret this as exactly one bounded remote development cycle.

Create one job:

```json
{
  "request_id": "<unique id>",
  "project": "EARLY_HEAT_RADAR",
  "action": "earlyheat_codex",
  "agent_mode": true,
  "prompt": "Read the latest handoff and harness state, perform exactly one next-priority bounded task, preserve the current HEAD and dirty overlay, keep real/live orders disabled and Paper/Shadow only, run relevant verification, and report evidence without claiming unverified PASS."
}
```

Coding jobs must be consumed only by the dedicated local EarlyHeat agent. They must never execute through a shared self-hosted coding lane.

## One-cycle protocol

1. Read the newest `KHS_REMOTE/results/earlyheat/latest.json` when present.
2. Check `KHS_REMOTE/earlyheat_agent_status.json` and the agent heartbeat exposed by a status snapshot.
3. Do not create a second coding job if an earlier `agent_mode=true` job is still pending or RUNNING.
4. Queue exactly one bounded coding job.
5. The dispatcher checks project locks, concurrent Codex processes and trading safety before Codex execution.
6. Codex runs with `workspace-write` only.
7. Preserve the real project dirty overlay. Never reset, clean, checkout, stash or rebase the Early Heat project.
8. Real/live order execution must remain disabled. Paper/Shadow only.
9. Publish the result under `KHS_REMOTE/results/earlyheat/`.
10. Report: completed work, current state, test/build evidence, blockers, next task.

## Retry policy

- `BLOCKED_CONCURRENT_CODEX` and `BLOCKED_LOCK`: dedicated agent waits and retries; do not launch another job.
- `FAIL_SAFETY`: stop coding. Do not retry until the safety condition is corrected.
- Other FAIL: do not silently loop implementation. Inspect evidence and issue a new bounded job only when appropriate.
- `NEEDS_VERIFICATION`: worker output is not a PASS by itself; use actual test/build evidence.

## Safety invariants

- LIVE order execution must never be enabled by remote development.
- Experimental entry rules remain Shadow unless the user explicitly changes the product policy in a separate request; remote automation still must not activate live orders.
- No credentials, .env contents, tokens or account identifiers may be copied into result files.
- The dedicated EarlyHeat agent is isolated from INDIE, AutoDirector and Mini-Jev coding queues.
