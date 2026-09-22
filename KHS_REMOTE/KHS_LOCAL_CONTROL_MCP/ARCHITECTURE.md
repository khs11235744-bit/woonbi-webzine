# Architecture

## 목표 구조

```text
                         +---------------------+
                         |     MCP Client      |
                         | ChatGPT / IDE / etc |
                         +----------+----------+
                                    |
                         HTTPS / MCP Streamable HTTP
                                    |
                 +------------------+------------------+
                 | Transport Adapter / Tunnel Manager |
                 +------------------+------------------+
                                    |
                  +-----------------v-----------------+
                  | Auth + Local Policy Gateway       |
                  | OAuth / capability / approvals    |
                  +------+---------+---------+--------+
                         |         |         |
          +--------------+    +----+----+    +----------------+
          |                   |         |                     |
  +-------v------+    +-------v----+ +--v-----------+ +------v------+
  | File Service |    | ProcessSvc | | Windows UI   | | Browser Svc |
  +-------+------+    +-------+----+ +------+-------+ +------+------+
          |                   |             |                |
          +-------------------+-------------+----------------+
                              |
                     +--------v---------+
                     | Task / Audit /   |
                     | Checkpoint Store |
                     +------------------+
```

## 프로세스 분리

- **gateway**: 외부 MCP 요청, 인증, 정책.
- **worker**: 파일/프로세스 실행. 임의 PID 제어 대신 gateway가 만든 opaque session id만 사용.
- **desktop host**: UI Automation과 화면 캡처.
- **tunnel supervisor**: Cloudflare/OpenAI/ngrok 상태 감시 및 재연결.
- **tray UI**: 사용자가 현재 연결/권한/작업을 확인하고 즉시 차단.

## 권한 프로필

### Read
파일 목록/읽기/검색/상태만 허용.

### Write
Workspace 내부 파일 생성·편집·이동을 추가.

### Control
Process session, screenshot, browser를 추가. 위험 동작은 로컬 승인.

### Full
세션 동안만 전체 제어. 저장하지 않으며 재시작 시 Control 이하로 복귀.

## v0.1 개발 원칙

- 외부에서 직접 PC 포트를 열지 않는다.
- 공개 URL은 transport일 뿐이며 로컬 정책이 항상 최종 권한자다.
- 모든 mutation은 감사 로그를 남긴다.
- secrets는 로그/도구 결과/자식 프로세스 환경에 전달하지 않는다.
