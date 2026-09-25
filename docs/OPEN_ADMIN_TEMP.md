# 웅비 관리자 모드 스위치

현재 기본 상태는 OPEN ADMIN이다. Google의 확인된 이메일로 로그인하면 관리자 기능을 사용할 수 있다.

## 웹에서 잠그기

- OPEN ADMIN 상태에서는 로그인 계정 상단에 **관리자 모드 잠그기** 버튼이 보인다.
- 누르면 Firestore `settings/access`에 `openAdmin=false`가 저장된다.
- Firestore와 Storage 규칙은 배포 없이 즉시 저장된 member 역할 기준으로 돌아간다.
- 잠근 뒤 다시 여는 기능은 저장된 `teacher` 계정만 사용할 수 있다.

## 다시 열기

- 저장된 교사 계정으로 로그인한다.
- 상단 **관리자 모드 열기**를 누른다.
- `settings/access.openAdmin=true`가 저장되면 Google 로그인 계정 전체 관리자 모드가 즉시 복구된다.

## 안전장치

- 설정 문서가 아직 없으면 OPEN ADMIN을 기본값으로 사용한다.
- 익명 사용자는 어떤 경우에도 관리자 권한을 얻지 못한다.
- 토글 기록은 `updatedAt`, `updatedBy`와 함께 저장된다.
- 사이트 주소를 모르는 것 자체는 보안 경계로 사용하지 않는다.
