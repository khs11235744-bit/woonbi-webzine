# Early Heat Radar — Android Alert Next Task

This task starts only after the market-session engine task
`earlyheat-session-engine-fix-20260921-1817` has produced a reviewed result.

## Goal

Deliver Android system notifications that can reach the user even when the app UI is not currently open, without enabling any live trading path.

## Required behavior

- Notification permission onboarding appropriate for modern Android.
- Separate notification channel for Early Heat alerts.
- User-selectable alert classes:
  - new Early Heat candidate
  - meaningful score/rank jump
  - Decision Funnel stage change
  - VWAP reclaim/loss
  - HOD approach/break
  - FOMO/risk escalation
  - watchlist-only alert
- Per-session toggles for DAYMARKET, PREMARKET, REGULAR and AFTERHOURS.
- Per-symbol mute plus global mute.
- Deduplication and cooldown so 30-second refreshes cannot spam identical alerts.
- Severity thresholds: all / important only / critical only.
- Tap notification -> deep-link to the relevant ticker/detail screen.
- A visible "test notification" control.
- Notification history inside the app, bounded and deduplicated.
- Explicit provider-degraded wording: never alert as if live day-market data exists when the selected feed does not support that session.
- Paper/Shadow only. Notifications are informational and never place orders.

## Architecture preference

Near-real-time stock alerts must not depend on a foreground browser timer. If the current app is a PWA/Capacitor/Android wrapper, prefer a push architecture (FCM or equivalent) driven by the scanner/backend. Android WorkManager/local periodic polling may be used only for non-urgent maintenance because Android background scheduling is not sufficiently precise for fast trading alerts.

If no backend push path exists yet, implement the Android permission/channel/settings/deep-link/test-notification foundation first and leave a clearly documented server/push adapter interface rather than faking background reliability.

## Verification

- permission accepted/denied paths
- app foreground/background handling
- duplicate suppression
- cooldown behavior
- deep-link payload parsing
- session-specific toggle
- provider-degraded suppression
- build/typecheck/lint/tests relevant to touched files
- no live-order capability introduced


## Q2 — Three distinct alert patterns

Create three user-visible Android notification channels so sound/vibration behavior is independently configurable at OS level:

1. EARLY_DISCOVERY
   - purpose: initial early-heat detection / watch candidate
   - default importance: DEFAULT
   - short, single vibration pulse
   - calmer default sound

2. ENTRY_WATCH
   - purpose: meaningful confirmation such as score jump, stage advance, VWAP reclaim, HOD approach
   - default importance: HIGH
   - two-pulse vibration pattern
   - more noticeable sound

3. RISK_FOMO
   - purpose: FOMO/risk escalation, invalidation, rapid reversal or provider integrity warning that materially changes interpretation
   - default importance: HIGH
   - distinct urgent multi-pulse vibration
   - distinct alert sound
   - never imply an order recommendation; informational warning only

Important Android channel rule: after a notification channel is created, sound/importance behavior is primarily controlled by the user/system settings. Use stable channel IDs and expose a button that opens each channel's system settings rather than trying to silently overwrite user choices.

## Q3 — Notification action buttons

Every actionable ticker notification should support, where appropriate:

- 관심종목 추가
  - add the symbol to the local/server watchlist idempotently
  - update notification state after success
- 30분 음소거
  - create a per-symbol mute-until timestamp
  - suppress subsequent duplicates and lower-severity alerts during the window
  - critical provider-integrity/safety alerts may remain visible if the product policy explicitly marks them non-mutable
- 차트 열기
  - deep-link directly to the ticker/detail/chart screen
  - preserve session context and alert reason in the route payload

Also:
- tapping the notification body opens the ticker detail view
- action PendingIntents must use unique request codes / immutable flags where required
- actions must be safe to repeat
- no action may place, stage, preview or submit an order
