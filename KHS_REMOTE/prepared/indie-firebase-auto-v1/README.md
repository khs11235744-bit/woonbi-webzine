# INDI+P Firebase Automation Bundle v1

Prepared for phone-first remote deployment.

## What it deploys
- syncDtryxSchedule: every 30 minutes
- syncNewsSchedule: every 3 hours
- syncHealth: read-only HTTP health endpoint
- Firestore writes:
  - public/live
  - public/movies
  - public/programs
  - public/newsRaw
  - public/newsWeekly
  - public/automationStatus

## Safety
- Dtryx or RSS failure never overwrites last-good public data with empty data.
- Errors are recorded in public/automationStatus.
- Existing translated news fields are preserved by article id.
- New untranslated news remains pending instead of fabricating Korean summaries.

## Remote execution sequence
1. indieplus_status
2. indieplus_apply_bundle bundle=indie-firebase-auto-v1
3. indieplus_test
4. indieplus_verify_commit (include functions/index.js, functions/package.json, functions/.gitignore, firebase.json)
5. indieplus_deploy confirm_deploy=true include_functions=true
6. Check syncHealth and Cloud Scheduler results.

## Cloud fallback
If Dtryx blocks Cloud Functions egress:
- keep news scheduler in Firebase
- preserve last-good Dtryx data
- switch only Dtryx refresh to the phone/local bridge scheduled lane
