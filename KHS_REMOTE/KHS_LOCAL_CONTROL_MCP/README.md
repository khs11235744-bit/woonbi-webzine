# KHS Local Control MCP

개인 Windows PC를 MCP 클라이언트와 연결하기 위한 **clean-room 원격 제어 브리지** 프로젝트입니다.

> 상태: experimental / private staging

## 목표

- Windows 파일 읽기·쓰기
- PowerShell 및 안전한 명령 실행
- 스크린샷·창 상태·마우스·키보드 제어
- MCP Streamable HTTP
- OAuth 기반 권한 부여
- Cloudflare Tunnel / OpenAI Secure MCP Tunnel / 로컬 LAN 등 다중 전송계층
- 읽기 / 쓰기 / 제어 / 완전제어 권한 프로필
- 감사 로그, 체크포인트, 세션 복구, 자동 재연결
- GUI 설치·일반/고급/복구 모드
- 특정 프로젝트 폴더만 허용하는 Workspace 모델

## 원칙

1. **기본은 최소 권한** — read-only가 기본.
2. **로컬 정책이 최종 권한자** — 원격 요청보다 PC의 로컬 정책이 우선.
3. **비밀키는 평문 저장 금지** — Windows DPAPI 또는 OS 보안 저장소 사용.
4. **공개 포트 금지** — 기본적으로 outbound-only tunnel 사용.
5. **위험 작업은 명시적 승인** — shell, GUI input, 삭제, 외부 네트워크 요청은 별도 승인 정책 적용.
6. **작업 복구 가능** — 장기 작업은 task id와 checkpoint로 재개.
7. **클라이언트 독립적** — ChatGPT뿐 아니라 표준 MCP 클라이언트에서도 사용 가능하게 설계.
8. **정식 제품 아님** — 개인 실험용으로 시작하며 보안 검증 전에는 공개 배포하지 않음.

## 권장 아키텍처

```text
MCP Client
   |
   v
Transport Adapter
(OpenAI Tunnel / Cloudflare / HTTPS)
   |
   v
Auth + Policy Gateway
   |
   +-- Filesystem Service
   +-- Process Service
   +-- Windows UI Service
   +-- Browser Service
   +-- Task/Checkpoint Service
   +-- Audit Service
```

## 현재 단계

- [x] 요구사항 및 경쟁 프로젝트 분석
- [x] 100개 개선 로드맵 작성
- [ ] clean-room core server
- [ ] Windows tray control panel
- [ ] installer
- [ ] signed release
- [ ] public repository split

## 참고 방향

기능 아이디어는 MCP 생태계의 일반 패턴과 여러 공개 프로젝트의 UX를 참고하지만, 라이선스가 불명확한 저장소의 코드는 복제하지 않고 새로 구현합니다.
