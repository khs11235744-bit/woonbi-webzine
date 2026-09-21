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
