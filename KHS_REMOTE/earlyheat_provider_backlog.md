# Early Heat Radar — Overnight / Day-Market Provider Backlog

This task starts only after:
`earlyheat-session-engine-fix-20260921-1817`
has produced a reviewed, test-backed result.

## Provider choice

### Primary: Alpaca Market Data
Official 24/5 docs expose overnight feeds:
- Free/basic: `feed=overnight`
  - latest bars
  - real-time indicative quotes
  - trades are 15-minute delayed
  - snapshots
- Paid Algo Trader Plus: `feed=boats`
  - latest quotes/trades/snapshots
  - historical BOATS bars/quotes/trades
- Assets API includes `overnight_tradable` and `overnight_halted`.

Use Alpaca as a market-data provider only in this task. Do not enable Alpaca order execution.

### Secondary: Interactive Brokers
IBKR advertises free overnight US stock market data with appropriate trading permission. Keep as an optional future adapter because it requires account/trading-permission integration and is less suitable as the default public market-data feed.

## Goal

Add a provider adapter capable of real overnight/day-market awareness without pretending delayed/indicative data is consolidated live tape.

## Requirements

1. Add an `alpacaOvernight`/equivalent provider adapter behind the existing provider abstraction.
2. Credentials must come from server-side/runtime configuration only. Never hardcode or expose keys in browser bundles, logs, result JSON or Git.
3. Support:
   - latest bar
   - latest indicative quote
   - snapshot
   - `overnight_tradable` eligibility
   - `overnight_halted`
4. Treat free-plan trade prints as delayed and label them explicitly. Do not use delayed trade timestamps as if they were real-time trade momentum.
5. Prefer quote/bar based momentum signals in free mode; enable real BOATS trade-based signals only when the feed capability explicitly says real-time BOATS is available.
6. Extend the provider capability model so the UI/scanner knows:
   - session coverage
   - quote latency class
   - trade latency class
   - indicative vs executable/consolidated semantics
7. Fail over cleanly to existing providers without converting ACTIVE_FEED_UNAVAILABLE into CLOSED.
8. Add health/status reporting visible in the app: provider, feed, last update age, overnight capability, degraded reason.
9. Add tests for:
   - overnight feed supported
   - credentials absent
   - 401/403/429/5xx
   - stale quote
   - 15-minute delayed trade correctly marked delayed
   - unsupported symbol / overnight_tradable=false
   - provider fallback
10. Paper/Shadow only. Absolutely no order submission endpoints, order models, or live-trading enablement.

## Cost/quality strategy

Start with Alpaca free/basic `overnight` feed to get useful DAYMARKET/overnight quote/bar awareness. Keep a clean configuration switch for `boats` paid feed later if real-time BOATS trades are worth the subscription.

## Next task after this

Android push notifications using the normalized session/provider-capability state.
