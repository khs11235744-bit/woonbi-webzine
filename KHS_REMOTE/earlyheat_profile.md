# Early Heat Radar Remote Profile

- Project: EARLY_HEAT_RADAR
- Local root: C:\Users\권형석\Documents\time drafe\early-heat-radar
- Runner: any available self-hosted Windows X64 runner on the approved PC; Codex execution still blocks on concurrent Codex/locks
- Mailbox: KHS_REMOTE/earlyheat_jobs/*.json
- Result: KHS_REMOTE/results/earlyheat/latest.json
- Dispatcher: KHS_REMOTE/earlyheat_dispatcher.ps1

## Allowed actions
- status: read-only snapshot of project, latest handoff, harness state, git state and trading safety flags.
- earlyheat_codex: execute exactly one bounded Codex task in the Early Heat Radar workspace.

## Hard safety
- Never enable real/live orders.
- Preserve Paper/Shadow operation.
- Never reset, clean, checkout, stash, rebase, or overwrite an existing dirty worktree.
- Never expose secrets or read .env/credential files into result output.
- Stop Codex execution when a harness/git lock or another Codex process is detected.
- Codex runs with workspace-write sandbox only.
- Every implementation task ends with git diff --check and a fresh safety check.
- Result JSON is evidence, not automatic PASS; tests/build output must support any completion claim.

## Job example
{
  "request_id": "earlyheat-example",
  "action": "earlyheat_codex",
  "project": "EARLY_HEAT_RADAR",
  "prompt": "Read the latest handoff and harness state, then perform exactly one bounded next-priority task. Keep Paper/Shadow only."
}


## Dedicated coding lane
- Read-only status: approved shared Windows self-hosted runner.
- Coding: `KHS_EARLYHEAT_REMOTE` local dedicated agent only.
- Persistent agent source: `KHS_REMOTE/earlyheat_agent.ps1`.
- Bootstrap: `.github/workflows/earlyheat-agent-bootstrap.yml`.
- Bootstrap status: `KHS_REMOTE/earlyheat_agent_status.json`.
- Shorthand contract: `KHS_REMOTE/earlyheat_command_contract.md`.
- "Early Heat 계속" means one and only one `agent_mode=true` bounded Codex cycle.
