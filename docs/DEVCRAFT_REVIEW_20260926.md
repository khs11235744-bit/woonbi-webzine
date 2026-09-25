# KHS DevCraft review — Woonbi v0.6

## PROJECT
C:\Users\권형석\Documents\woonbi-webzine-v0.6-work  
branch: woonbi-webzine-v0.6

## TASK
학교 Google 계정에서 공유 사진을 가장 짧은 흐름으로 웅비에 가져오고, OPEN ADMIN을 나중에 잠가도 학교 관리자 계정이 잠기지 않게 한다.

## ACCEPTANCE
- Picker에서 고른 사진은 별도 두 번째 전송 클릭 없이 중복·기사추천 분석으로 이어진다.
- Picker 오류가 빈 화면/모호한 실패가 아니라 다음 조치가 보이는 메시지로 나온다.
- OPEN ADMIN을 잠그면 외부 Google 계정은 저장된 역할로 복귀한다.
- 검증된 @phhs.kr 계정은 잠금 뒤에도 교사 관리자 기능을 유지한다.
- 익명 사용자는 관리자 기능에 접근하지 않는다.
- 기존 잡지/웹진/사진 자료실 기능은 회귀하지 않는다.

## DO NOT
- 다른 프로젝트 수정 금지.
- reset / clean 금지.
- 현재 편집·잡지 기능 재설계 금지.
- 이번 작업과 무관한 app.js 대규모 refactor 금지.

## REUSE SCOUT

### Google Picker
**WRAP**

현재 Google PickerBuilder를 유지하되 공식 Google Picker 규약 뒤에 Woonbi adapter를 둔다. Google 공식 문서의 `drive.file`, `setAppId(project number)`, `setOrigin`, multi-select 흐름을 따른다.

공식 `@googleworkspace/drive-picker-element`도 검토했지만 이번 변경에서는 도입하지 않는다. 현재 정적 앱에 새 런타임/클라이언트 설정을 추가하는 것보다 기존 adapter를 공식 규약에 맞춰 안정화하는 변경이 더 작고 되돌리기 쉽다. 별도 Web OAuth Client ID를 정식 운영 설정으로 확정하는 시점에 migration 후보로 다시 검토한다.

### UI
**BUILD**

웅비의 편집·교지 디자인 문법은 제품 고유 영역이므로 generic SaaS UI library로 교체하지 않는다. 첫 행동과 오류 상태만 단순화한다.

### Access mode
**BUILD**

Firebase Rules + 기존 member role 위에 작은 runtime access switch를 유지한다. 잠금 모드에서 @phhs.kr 검증 계정을 school teacher fallback으로 사용해 lockout을 방지한다.

## CHANGES
- Picker에 explicit origin / NAV_HIDDEN / ERROR handling 추가.
- Picker 선택 직후 자동 분석.
- API key / popup / Workspace policy 오류 메시지 구체화.
- 잠금 모드에서 @phhs.kr 계정의 teacher fallback 추가.
- 관련 unit/rules regression test 추가.

## DEFERRED BACKLOG
1. `web/js/app.js` 100KB급 단일 모듈 분리. 기능 변경과 섞지 않고 별도 refactor로 진행.
2. 공식 `@googleworkspace/drive-picker-element` migration은 Web OAuth Client ID 운영 설정이 확정된 뒤 별도 branch에서 비교.
3. 390/768/1440 live visual regression 자동화.
4. OPEN ADMIN 장기 운영 금지. 사진 이관 완료 뒤 학교 계정/저장 역할 기반으로 잠그기.

## VERIFICATION TARGET
STATIC → UNIT → RULES INTEGRATION → LIVE DEPLOY → SCHOOL ACCOUNT PICKER

최종 PASS는 학교 계정에서 실제 Picker 선택 후 사진이 자료실 분석까지 들어간 것을 확인한 경우에만 선언한다.


## LEARNING LEDGER

### OBSERVED — Firestore Rules regex escaping
- situation: school-domain teacher fallback rule
- action: used an escaped dot inside a Rules regex string
- result: emulator compiler rejected the rule
- correction: use `[.]` in the regex instead of relying on backslash escaping
- evidence: rules emulator compiled and 17/17 security tests passed after correction
- candidate scope: Woonbi/Firebase Rules projects
- confidence: medium

### OBSERVED — Picker first-success path
- situation: user selected Drive photos but still had another manual transfer step
- action: Picker selection now immediately downloads supported selected files and invokes Woonbi duplicate/article analysis
- evidence: unit regression coverage added; live school-account final selection still requires user OAuth consent
- candidate scope: Woonbi
- confidence: medium

### CANDIDATE — Workspace Picker authentication
- trigger: Firebase main-session reauthentication produces a stalled/blank popup on a Workspace account
- recommended behavior: use an isolated OAuth/Firebase auth session for Drive consent so the main Woonbi session is untouched
- evidence: account chooser is reached reliably; full picked-file live verification remains pending
- scope: Woonbi
- confidence: medium


### OBSERVED — static UI audit can miss real responsive failure
- situation: source-based Anti-Slop audit reported 100/100
- evidence: live 768px and 1440px screenshots still showed footer Korean navigation labels breaking vertically
- correction: footer nav gets explicit no-wrap labels and a tablet-specific two-row composition
- rule candidate: source/static UI audits do not replace 390/768/1440 browser screenshots
- scope: Woonbi
- confidence: high


## FINAL VERIFICATION

- STATIC: PASS — syntax/check/diff checks pass.
- UNIT: PASS — npm test 115/115.
- INTEGRATION: PASS — Firebase Rules emulator 17/17 after the access-mode/domain fallback change.
- LIVE DEPLOY: PASS — Hosting and Firestore/Storage rules deployed to `woonbi-webzine-2026`.
- VISUAL 390/768/1440: PASS for the inspected public/login shell after fixing footer label fracture.
- SCHOOL ACCOUNT PICKER: PARTIAL — the real school Google account is visible in the account chooser and the live Picker path reaches Google authorization; a final selected file has not yet been confirmed end-to-end in this DevCraft pass.

Overall DevCraft status: **PARTIAL** until one real school Drive image is picked and appears in Woonbi's duplicate/article analysis.
