# Mini-Jev P2-1 — GitHub-native router evaluation set

This bounded change replaces the unavailable local-runner dependency for **evaluation data only**. It does not claim to reconstruct the unavailable local KHS_MINI_JEV source tree.

## Files
- `router_eval_600.jsonl`: 600 synthetic, deterministically generated evaluation cases.
- `khs_flow_holdout_120.jsonl`: separate 120-case KHS FLOW realistic-style holdout.
- `validate_p2_1.py`: schema, count, balance and routing-invariant validator.

## Preserved routing contract
1. Deterministic guard runs before learned routing.
2. Local model is limited to small bounded classification/review/small-edit work.
3. Complex implementation remains under frontier/WebChat authority.
4. GUI/vision prefers Antigravity when available, otherwise WebChat/frontier.
5. Blocked/high-risk cases never silently fall through to local execution.
6. Worker output is not PASS until actual files/tests are verified.
7. Provenance should use current HEAD plus dirty overlay rather than assuming origin/main.

## Scope
P2-1 only. No calibration, temperature/prompt tuning, or weight fine-tuning is included here. The holdout is synthetic realistic-style KHS FLOW data, not copied user logs and not a benchmark result by itself.

Run:
```bash
python KHS_MINI_JEV/evals/validate_p2_1.py
```
