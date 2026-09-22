# KHS Local Control MCP — 개선 로드맵 100

우선순위 표기: **P0** 즉시, **P1** 핵심, **P2** 확장, **P3** 장기.

## A. 설치·온보딩·GUI
1. **P0** Windows 단일 설치파일(EXE/MSI) 제공.
2. **P0** 첫 실행 마법사: 일반 / 고급 / 복구 3모드.
3. **P0** 사용자가 폴더를 직접 선택하는 Workspace picker.
4. **P0** 시스템 트레이 아이콘과 연결 상태 표시.
5. **P1** 원클릭 Start / Stop / Restart 버튼.
6. **P1** “연결 테스트” 버튼으로 로컬 MCP, 인증, 터널을 한 번에 검사.
7. **P1** 초보용 상태 문구: “정상”, “인터넷 연결 필요”, “로그인 필요”처럼 한국어 표시.
8. **P1** 설치 시 Node/npm 등 런타임을 앱에 번들해 별도 설치 제거.
9. **P2** 자동 업데이트 + 롤백.
10. **P2** 완전한 portable ZIP 버전 추가.

## B. 네트워크·터널
11. **P0** Cloudflare Quick Tunnel 자동 시작/주소 감지.
12. **P0** 터널 재시작 시 새 URL을 UI에서 즉시 표시.
13. **P0** 네트워크 사전 점검(DNS/TCP/UDP/443) 패널.
14. **P1** Cloudflare Named Tunnel 지원.
15. **P1** OpenAI Secure MCP Tunnel 어댑터.
16. **P1** ngrok 어댑터.
17. **P1** Tailscale Funnel/Serve 선택지.
18. **P2** 여러 전송 방식 자동 fallback.
19. **P2** 회사·학교 프록시 환경 설정 UI.
20. **P2** 터널 latency/packet loss/재연결 횟수 표시.

## C. 인증·보안
21. **P0** 기본 권한을 Read Only로 강제.
22. **P0** 비밀키 평문 .env 저장 제거.
23. **P0** Windows DPAPI로 토큰·키 암호화.
24. **P0** 위험 도구별 권한 분리: file-write / shell / GUI / network / admin.
25. **P0** 삭제·프로세스 종료·시스템 변경은 별도 승인.
26. **P1** 세션별 임시 Full Control 권한.
27. **P1** Full Control은 재시작 시 자동 해제.
28. **P1** OAuth access token + refresh token 지원.
29. **P1** OAuth PKCE/state 검증 강화.
30. **P1** OAuth Client ID Metadata Documents(CIMD) 대응.
31. **P1** Allowlist root 밖 경로 차단.
32. **P1** symlink/junction/reparse point 탈출 차단.
33. **P1** .ssh/.aws/.env/.npmrc 등 민감 경로 기본 차단.
34. **P1** 명령별 denylist 대신 capability allowlist 방식.
35. **P1** Windows UAC 우회 금지 및 명시적 로컬 승인.
36. **P2** IP/클라이언트 fingerprint 기반 세션 알림.
37. **P2** 무작위 공격 방지 rate limit.
38. **P2** 세션 자동 만료와 강제 revoke.
39. **P2** 보안 감사 모드: 위험 설정 자동 탐지.
40. **P2** “긴급 잠금” 버튼으로 모든 원격 제어 즉시 차단.

## D. 파일 시스템 도구
41. **P0** list/read/write/create/move/delete 기본 도구.
42. **P0** 기존 파일 수정 전 fresh-read token 요구.
43. **P1** edit-block / apply-patch 지원.
44. **P1** 여러 파일 동시 읽기.
45. **P1** glob 기반 파일 검색.
46. **P1** 내용 검색(ripgrep) + 결과 pagination.
47. **P1** 대용량 파일 부분 읽기(offset/length).
48. **P1** 바이너리 파일 metadata 조회.
49. **P1** 자동 백업 후 수정.
50. **P1** 변경 전후 diff 반환.
51. **P2** ZIP 압축/해제.
52. **P2** 임시 artifact 생성과 다운로드 링크.
53. **P2** 파일 SHA-256 무결성 확인.
54. **P2** 파일 변경 watch.
55. **P2** 프로젝트별 ignore 규칙(.gitignore 호환).

## E. 터미널·개발도구
56. **P0** 장시간 실행 가능한 process session.
57. **P0** stdout/stderr polling.
58. **P0** process interact(stdin) 지원.
59. **P0** process terminate 지원.
60. **P1** PowerShell/CMD/Git Bash 선택.
61. **P1** cwd를 세션별로 유지.
62. **P1** npm/pnpm/yarn 자동 감지.
63. **P1** git status/diff/commit 도구를 shell과 별도 제공.
64. **P1** 테스트 실패 첫 원인 요약.
65. **P1** build/test/lint preset.
66. **P1** background job + job id.
67. **P2** Docker 감지 및 제한된 컨테이너 실행.
68. **P2** Python venv/Node version manager 감지.
69. **P2** IDE(VS Code) 프로젝트 열기.
70. **P2** 로컬 dev server URL 자동 감지.

## F. Windows 화면·브라우저 제어
71. **P0** 스크린샷 도구.
72. **P0** 창 목록 + foreground window 조회.
73. **P1** 창 focus/minimize/maximize/move.
74. **P1** UI Automation 기반 요소 탐색.
75. **P1** 좌표 클릭보다 element action 우선.
76. **P1** 마우스/키보드 동작 전 fresh screenshot/observation 요구.
77. **P1** Chrome/Edge 전용 브라우저 세션.
78. **P1** 개인 브라우저와 분리된 전용 프로필.
79. **P1** 로그인 상태를 유지하는 persistent profile.
80. **P1** 다운로드/업로드를 Workspace 경계 안에서만 허용.
81. **P2** 접근성 트리 snapshot.
82. **P2** 다중 모니터 인식.
83. **P2** Windows Virtual Desktop별 Agent Desktop.
84. **P2** 사용자 마우스를 뺏지 않는 백그라운드 Agent Desktop.
85. **P3** OCR-free visual element grounding 보조.

## G. 작업·자동화·복구
86. **P0** Task ID와 체크포인트.
87. **P0** 중단 후 resume.
88. **P1** 단계별 TODO 상태.
89. **P1** 실패 시 마지막 안전 체크포인트 rollback.
90. **P1** 작업별 로그/결과/파일을 묶은 Task Room.
91. **P1** PC 재부팅 후 미완료 작업 복원.
92. **P1** “작업 끝나면 검증” final gate.
93. **P2** 예약 작업 및 조건 감시 hooks.
94. **P2** GitHub Actions/self-hosted runner와 보조 연동.
95. **P2** 여러 프로젝트 동시 작업 큐.

## H. MCP 호환성·관측·배포
96. **P0** MCP Streamable HTTP 최신 사양 추적 및 protocol version negotiation.
97. **P1** MCP Tasks extension 대응.
98. **P1** MCP Apps/UI surface를 통한 상태 대시보드.
99. **P1** 구조화 audit log + 민감정보 자동 redaction.
100. **P1** CI: Windows x64 설치→실행→MCP 도구 스캔→파일/프로세스/GUI smoke→업그레이드/롤백 자동 검증.

---

## 바로 구현할 Top 15

1. Tray GUI
2. Read/Write/Control/Full 권한 프로필
3. DPAPI secret store
4. Workspace picker + 민감경로 차단
5. Cloudflare Quick Tunnel one-click
6. Named Tunnel 선택 지원
7. OAuth refresh token
8. File fresh-observation + diff
9. Persistent process sessions
10. Screenshot + window snapshot
11. Task/checkpoint/resume
12. Audit log/redaction
13. Auto-reconnect watchdog
14. Windows startup
15. Installer + rollback
