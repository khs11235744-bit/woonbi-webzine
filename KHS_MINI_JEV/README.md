# KHS Mini-Jev — GitHub-native core

Mini-Jev is being rebuilt so that its routing policy and verification contract can be developed without depending on a self-hosted runner.

## Current stage

- P2-1: 600-case balanced router eval + separate 120-case KHS FLOW holdout
- P2-2: deterministic calibration profiles + executable routing core
- P2-3: per-project policies and metadata-only feedback logging — next

## Core contract

1. Deterministic guard runs before task/learned routing.
2. Local workers are limited to bounded classify/review/small low-risk edits.
3. Complex implementation is FRONTIER/WebChat authority only.
4. GUI/vision prefers Antigravity when available.
5. Worker output is always `NEEDS_VERIFICATION` until real files/tests are checked.
6. `origin/main` is not assumed to be the actual local state.
7. Routing logs must contain metadata, not secrets.

## Run it

No third-party Python package is required.

```bash
python KHS_MINI_JEV/run_minijev.py "여러 파일 기능을 구현하고 테스트까지 확인해줘" --availability full
```

## Test

```bash
python -m unittest discover -s KHS_MINI_JEV/tests -v
python KHS_MINI_JEV/evals/validate_p2_1.py
python KHS_MINI_JEV/calibration/calibrate_p2_2.py
```

## P2-2 calibration

The calibration sequence is represented explicitly:

`baseline → jeff_prompt → jeff_noul → jeff_noul_isolated → jeff_noul_isolated_t0 → guard_threshold_v2`

Temperature is configuration metadata for future learned routing. The current core remains deterministic. Fine-tuning is not started unless deterministic/prompt calibration plateaus.

The original P2-1 KHS FLOW holdout is preserved unchanged. Because identical holdout prompts can carry different structured risk labels, P2-2 reports text-only risk scoring on that set as `UNSCORABLE` instead of fabricating a model score. Its structured routing policy is still testable.
