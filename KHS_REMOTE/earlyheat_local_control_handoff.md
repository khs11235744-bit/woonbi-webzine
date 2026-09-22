# Early Heat Radar — Local Computer Control Handoff

Primary development transport is now Local Computer Control.

## Project
- Root: C:\Users\권형석\Documents\time drafe\early-heat-radar
- Preserve current local HEAD and dirty worktree.
- Never run git reset/clean/checkout/stash/rebase unless the user explicitly asks.
- Real/live order execution must remain disabled.
- Paper/Shadow only.

## First connection sequence
1. Call computer_status.
2. Confirm the approved Windows PC is online.
3. Confirm the project root exists.
4. Read git HEAD, branch, status/dirty files.
5. Read the newest handoff/state files under .runtime, especially automation-handoff-latest.json and harness-state.json when present.
6. Read relevant package scripts/test commands before editing.
7. Confirm live-order safety flags before and after each task.

## Current priority order
1. Fix PREMARKET and DAYMARKET/overnight session detection and scanner behavior.
   - Canonical exchange timezone: America/New_York.
   - Handle DST correctly.
   - Do not confuse active market with unsupported/degraded feed.
   - Keep one shared session engine for radar/session ribbon/workspace.
   - Test DST, winter, boundaries, midnight crossing, weekend/holiday behavior.
2. Add/verify overnight/day-market provider capability.
   - Prefer Alpaca market-data-only adapter first.
   - Free overnight feed may provide indicative quotes/latest bars while trades can be delayed.
   - Never fabricate live trades.
   - Never add order submission.
3. Android notification implementation and validation.
   - Android 13+ POST_NOTIFICATIONS.
   - Prefer push/FCM for app-closed/background reliability.
   - Channels: EARLY_DISCOVERY, ENTRY_WATCH, RISK_FOMO.
   - Per-session toggles: DAYMARKET/PREMARKET/REGULAR/AFTERHOURS.
   - Dedupe/cooldown.
   - Actions: 관심종목 추가 / 30분 음소거 / 차트 열기.
   - Deep-link to ticker detail/chart.
   - Provider-degraded suppression/wording.
4. Launch Android emulator from installed Android Studio and perform real notification smoke tests.
   - permission grant/deny
   - foreground
   - background
   - app process killed where feasible
   - notification channel behavior
   - action buttons
   - deep links
   - duplicate suppression
   - session toggles
   - test notification
5. Run relevant unit tests, lint/typecheck/build, git diff --check.
6. Report exact files changed, tests/build results, blockers, and next bounded task.

## Remote policy
- GitHub Early Heat automation is standby fallback only.
- GitHub Codex fallback requires an explicit manual_fallback=true emergency request.
- Do not use GitHub automatic coding when Local Computer Control is available.

## User shorthand
When the user says "Early Heat 계속", perform exactly one bounded next-priority development cycle using Local Computer Control, then report the result.
