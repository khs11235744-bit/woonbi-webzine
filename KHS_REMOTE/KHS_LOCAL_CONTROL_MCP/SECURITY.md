# SECURITY

이 프로젝트는 원격 PC 제어 기능을 포함하므로 일반 웹앱보다 훨씬 보수적으로 운영한다.

## 기본 정책

- Default = Read Only.
- Workspace 외 경로는 거부.
- .env, .ssh, .gnupg, .aws, credential 파일은 기본 거부.
- 삭제, shell, GUI input, 외부 network request는 privileged action.
- Full 권한은 session-only.
- 비밀값은 Windows DPAPI를 사용해 현재 사용자 범위로 보호.
- 모든 privileged action은 audit event 생성.
- 로그에 파일 내용, API key, Authorization header, clipboard 본문을 기록하지 않음.
- UAC, 잠금화면, MFA, CAPTCHA 우회 기능을 만들지 않음.

## 공개 배포 전 필수

1. Threat model 작성
2. path traversal / symlink / junction 테스트
3. OAuth state/PKCE/refresh 테스트
4. command injection 테스트
5. prompt injection 시나리오 테스트
6. installer rollback 테스트
7. Windows clean-user E2E
8. secret scanning
9. dependency audit
10. code signing 또는 checksum release

## 신고

공개 저장소로 분리할 때 GitHub Private Vulnerability Reporting을 활성화한다.
