# KHS Remote Console

휴대폰에서 GitHub에 로그인한 뒤 **Issues → New issue → KHS Remote Console**을 선택합니다.

## 한 화면에서 할 수 있는 것
- Mini-Jev 상태 확인 / 한 단계 계속 / Codex / Antigravity / WebChat
- INDIE 상태 확인 / 한 단계 계속 / Codex / Antigravity / WebChat
- AutoDirector 상태 확인 / 한 단계 계속 / Codex / Antigravity / WebChat

## 상태 의미
- PASS: 실제 verifier까지 통과한 경우에만 사용
- NEEDS_VERIFICATION: Codex 작업은 끝났지만 독립 검증이 더 필요
- QUEUED: Antigravity/WebChat sidecar 요청이 프로젝트에 기록됨
- FAIL/BLOCKED/STOPPED: 실제 실패 또는 안전 차단

## 보안
- 비밀키, 토큰, 비밀번호를 Issue에 적지 않음
- GitHub 로그인 자체를 인증으로 사용
- 별도 공개 원격 서버나 브라우저 저장 토큰 없음
