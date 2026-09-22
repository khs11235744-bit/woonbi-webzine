# 독립 공개 저장소 분리 계획

현재 코드는 비공개 통합 저장소의 KHS_REMOTE/KHS_LOCAL_CONTROL_MCP 아래에서 개발한다.

## 공개 분리 조건

1. LICENSE 결정(MIT 또는 Apache-2.0 권장)
2. LICENSE / NOTICE 추가
3. 타 프로젝트 코드가 포함되지 않았음을 재검토
4. secret scan 0건
5. Windows clean-user 설치 테스트
6. Read-only 기본값 확인
7. unsafe shell 기본 비활성
8. symlink/junction escape 테스트
9. OAuth/권한 모델 완성
10. installer rollback 테스트
11. screenshot/GUI 도구 안전성 검증
12. CI green
13. README 한글/영문 병기
14. SECURITY.md + private vulnerability reporting
15. v0.1.0 release checksum

## 권장 저장소 이름

khs-local-control-mcp

## 공개 후 브랜치

- main: 안정 버전
- dev: 다음 버전
- feature/*: 기능 개발

## 릴리스

- Windows x64 installer
- portable ZIP
- SHA256SUMS.txt
- release-manifest.json
- changelog
